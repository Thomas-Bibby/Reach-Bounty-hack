'reach 0.1';

const Issue = Struct([
  ["votesNeeded", UInt],
  ["totalVotes", UInt],
  ["votingOpen", Bool],
]);

const Vote = Struct([
  ["amount", UInt],
  ["voterAddress", Address],
]);

const Opts = Struct([
  ["voteToken", Token],
]);

export const main = Reach.App(() => {
  ////////// Initial Setup \\\\\\\\\\
  const Deployer = Participant("Deployer", {
    opts: Opts,
  });
  const Voter = API("Voter", {
    vote: Fun([UInt], Vote),
  });
  const issue = Issue.fromObject({
    votesNeeded: 10,
    totalVotes: 0,
    votingOpen: true,
  });

  const V = View({
    opts: Opts,
    issue: Issue,
    totalVotesOverall: UInt,
  });
  init();
  ////////// Initial Setup \\\\\\\\\\

  Deployer.only(() => {
    const opts = declassify(interact.opts);
    const { voteToken } = opts;
  });

  Deployer.publish(voteToken);
  commit();

  Deployer.pay([[0, voteToken]]);

  const Voters = new Map(UInt); // amt staked by addr

  const lookupStaked = (addr) => fromSome(Voters[addr], 0);

  ////////// API setup \\\\\\\\\\
  const [ totalVotesOverall ] = parallelReduce([0])
  .define(() => {
    // Any initial definitions or assert functions
    V.totalVotesOverall.set(0);
  })
  .invariant(
    balance() == 0
  )
  .paySpec([voteToken]) // Pay spending of tokens
  .while(totalVotesOverall != 0)
  ////////// API setup \\\\\\\\\\
  ////////// API Functions \\\\\\\\\\
  .api(
    Voter.vote,
    (amt) => [[amt, voteToken]],
    (amt, k) => {
      // Unchanged variables
      const votesNeeded = issue.votesNeeded;
      // Check if voting is opened
      assert(issue.votingOpen === true, "Voting has already closed");

      // Calculating new total votes 
      const totalVotes = issue.totalVotes + amt;
      
      // Adding user to voting pool if they arn't already
      if (Voters[this] === null) {
        const newUserVoted = lookupStaked(this) + amt;
        Voters[this] = newUserVoted;
      }
      transfer([[amt, voteToken]]).to(Deployer);
      const votingOpen = true;

      k(Issue.fromObject({ votesNeeded, totalVotes, votingOpen }));

      // Setting values back to struct
      //k(Issue.fromObject({ votesNeeded, totalVotes, votingOpen }));

      return [issue.totalVotes, votesNeeded];
    }
  );
  ////////// API Functions \\\\\\\\\\
});