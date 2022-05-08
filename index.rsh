"reach 0.1";

const Issue = Struct([
  ["creatorAddress", Address],
  ["votesNeeded", UInt],
  ["totalVotes", UInt],
  ["votesFor", UInt],
  ["votesAgainst", UInt],
  ["votingClosed", Bool],
  ["votingResult", UInt], // 0 = false, 1 = true, 2 = pending
]);

const Vote = Struct([
  ["amount", UInt],
  ["voteForIssue", Bool],
  ["voterAddress", Address],
]);

const Opts = Struct([["voteToken", Token]]);

export const main = Reach.App(() => {
  setOptions({
    // Users deleting their own local state would only hurt themselves.
    // They would lose access to rewards and stake that should be rightfully theirs.
//untrustworthyMaps: false,
    // Would like to turn this on but it would take more time to satisfy the theorem prover.
//verifyArithmetic: false,
  });
  ////////// Initial Setup \\\\\\\\\\
  const Deployer = Participant("Deployer", {
    opts: Opts,
    readyForStakers: Fun([], Null),
  });
  const Voter = API("Voter", {
    createIssue: Fun([UInt, UInt], Issue),
    verifyResult: Fun([], Issue),
    voteFor: Fun([UInt], Vote),
    voteAgainst: Fun([UInt], Vote),
  });

  const V = View({
    opts: Opts,
    issue: Issue,
    voted: Fun([Address], UInt),
    issueTotalVotes: UInt,
    issueCreatorAdd: Address,
    issueVotesNeeded: UInt,
    issueTotalVotesFor: UInt,
    issueTotalVotesAgainst: UInt,
    issueVotagePercentage: UInt,
  });
  init();
  ////////// Initial Setup \\\\\\\\\\

  Deployer.only(() => {
    const opts = declassify(interact.opts);
    const { voteToken } = opts;
  });

  Deployer.publish(opts, voteToken);
  V.opts.set(opts);
  commit();

  const paymentAmount = 10000;
  Deployer.pay([[paymentAmount, voteToken]]);

  const Voters = new Map(UInt); // amt Voted by addr

  const lookupVoter = (addr) => fromSome(Voters[addr], 0);
  V.voted.set(lookupVoter);

  ////////// API setup \\\\\\\\\\
  Deployer.interact.readyForStakers();
  const [
    IssueCreatorAdd,
    IssueVotesNeeded,
    IssueTotalVotes,
    IssueTotalVotesFor,
    IssueTotalVotesAgainst,
    IssueVotagePercentage,
  ] = parallelReduce([this, 0, 0, 0, 0, 0])
    .define(() => {
      const lct = lastConsensusTime();
      // Any initial definitions or assert functions
      V.issueTotalVotes.set(IssueTotalVotes);
      V.issueCreatorAdd.set(IssueCreatorAdd);
      V.issueVotesNeeded.set(IssueVotesNeeded);
      V.issueTotalVotesFor.set(IssueTotalVotesFor);
      V.issueTotalVotesAgainst.set(IssueTotalVotesAgainst);
      V.issueVotagePercentage.set(IssueVotagePercentage);
    })
    .invariant(balance() == 0 && balance(voteToken) >= 0 && balance(voteToken) >= IssueTotalVotes) // FIGURE OUT WHY this causes an invariant after loop
    .paySpec([voteToken])
    .while(IssueTotalVotes >= 0 && balance(voteToken) >= IssueTotalVotes)
      /////////  API setup  \\\\\\\\\
    ////////// API Functions \\\\\\\\\\
    .api(
      Voter.createIssue,
      (votesNeeded, votesPerc) => {
        // Check user is deployer
        assume(IssueTotalVotes >= IssueVotesNeeded, "Another issue is still open");
      },
      (votesNeeded, votesPerc) => [0, [0, voteToken]], // completes transfer for us
      (votesNeeded, votesPerc, k) => {
        // Return the new issue array
        const newIssueCreatorAddress = this;
        const newIssue = Issue.fromObject({
          creatorAddress: newIssueCreatorAddress,
          votesNeeded: votesNeeded,
          totalVotes: 0,
          votesFor: 0,
          votesAgainst: 0,
          votingClosed: false,
          votingResult: 2,
        });
        k(newIssue);
        return [newIssueCreatorAddress, votesNeeded, 0, 0, 0, votesPerc];
      }
    )
    .api(
      Voter.verifyResult,
      () => {
        assume(
          IssueCreatorAdd == this,
          "You didn't create the issue you can't close it"
        );
        assume(IssueTotalVotes >= IssueVotesNeeded, "Voting has not closed");
        assume(IssueTotalVotes <= balance(voteToken));
      },
      () => [0, [0, voteToken]], // completes transfer for us
      (k) => {
        // Calculate if issue was successful
        const calcPer = (IssueTotalVotesFor * 100) / IssueTotalVotes; // it doesn't like decimals so * 100 stops that decimal issue
        if (calcPer >= IssueVotagePercentage)
        { // Vote was successful
          const closedIssue = Issue.fromObject({
            creatorAddress: IssueCreatorAdd,
            votesNeeded: IssueVotesNeeded,
            totalVotes: IssueTotalVotes,
            votesFor: IssueTotalVotesFor,
            votesAgainst: IssueTotalVotesAgainst,
            votingClosed: true,
            votingResult: 1,
          });
          k(closedIssue);
        } else 
        { // Vote was not successful
          const closedIssue = Issue.fromObject({
            creatorAddress: IssueCreatorAdd,
            votesNeeded: IssueVotesNeeded,
            totalVotes: IssueTotalVotes,
            votesFor: IssueTotalVotesFor,
            votesAgainst: IssueTotalVotesAgainst,
            votingClosed: true,
            votingResult: 0,
          });
          k(closedIssue);
        }

        transfer(IssueTotalVotes, voteToken).to(IssueCreatorAdd);

        return [
          IssueCreatorAdd,
          0,
          0,
          0,
          0,
          0,
        ];
      }
    )
    .api(
      Voter.voteFor,
      (amt) => {
        assume(IssueTotalVotes <= IssueVotesNeeded, "Voting has already closed");
        assume(IssueCreatorAdd != this, "You can't vote on your own issue");
        assume(amt > 0, "You must vote with more than one voting token");
      },
      (amt) => [0, [amt, voteToken]], // completes transfer for us
      (amt, k) => {
        // Calculating new total votes
        const newIssueTotalVotesFor = IssueTotalVotesFor + amt;
        const newIssueTotalVotes = IssueTotalVotes + amt;

        // Adding user to voting pool and how much they have voted
        const newUserVoted = lookupVoter(this) + amt;
        Voters[this] = newUserVoted;

        const newVote = Vote.fromObject({
          amount: amt,
          voteForIssue: true,
          voterAddress: this,
        });

        k(newVote);
        return [
          IssueCreatorAdd,
          IssueVotesNeeded,
          newIssueTotalVotes,
          newIssueTotalVotesFor,
          IssueTotalVotesAgainst,
          IssueVotagePercentage,
        ];
      }
    )
    .api(
      Voter.voteAgainst,
      (amt) => {
        assume(IssueTotalVotes <= IssueVotesNeeded, "Voting has already closed");
        assume(IssueCreatorAdd != this, "You can't vote on your own issue");
        assume(amt > 0, "You must vote with more than one voting token");
      },
      (amt) => [0, [amt, voteToken]], // completes transfer for us
      (amt, k) => {
        // Calculating new total votes
        const newIssueTotalVotesAgainst = IssueTotalVotesAgainst + amt;
        const newIssueTotalVotes = IssueTotalVotes + amt;

        // Adding user to voting pool and how much they have voted
        const newUserVoted = lookupVoter(this) + amt;
        Voters[this] = newUserVoted;

        const newVote = Vote.fromObject({
          amount: amt,
          voteForIssue: false,
          voterAddress: this,
        });

        // send tokens if voting is closed

        k(newVote);
        return [
          IssueCreatorAdd,
          IssueVotesNeeded,
          newIssueTotalVotes,
          IssueTotalVotesFor,
          newIssueTotalVotesAgainst,
          IssueVotagePercentage,
        ];
      }
    );
  commit();
  fork().case(
    Deployer,
    () => ({}),
    (_) => 0,
    () => {}
  );

  transfer([[balance(voteToken), voteToken]]).to(Deployer);
  commit();

  exit();
  ////////// API Functions \\\\\\\\\\
});
