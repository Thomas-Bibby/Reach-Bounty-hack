import {loadStdlib} from '@reach-sh/stdlib';
import * as backend from './build/index.main.mjs';
const stdlib = loadStdlib(process.env);

// util functions
const fmt = (x) => stdlib.formatCurrency(x, 4);
const getBalance = async (acc) => fmt(await stdlib.balanceOf(acc));
const btok = async (acc, tok) => {
  try {
    return await stdlib.balanceOf(acc, tok.id);
  } catch (e) {
    console.warn(e);
    return 0;
  }
};
function pretty(r) {
  if (!r) {
    return r;
  } else if (typeof r === "string") {
    return r;
  } else if (r._isBigNumber) {
    return r.toString();
  } else if (r.networkAccount) {
    if (r.networkAccount.addr) {
      return r.networkAccount.addr.slice(0, 8);
    } else if (r.networkAccount.address) {
      return r.networkAccount.address.slice(0, 8);
    } else {
      return "<some acc>";
    }
  } else if (Array.isArray(r) && r[0] == "Some") {
    return pretty(r[1]);
  } else if (Array.isArray(r)) {
    return r.map((x) => pretty(x));
  } else if (Object.keys(r).length > 0) {
    const o = {};
    for (const k in r) {
      o[k] = pretty(r[k]);
    }
    return o;
  } else if (r.toString) {
    return r.toString();
  } else {
    return r;
  }
}
const balances = async (token, accDeployer, accVoters) => {
  const t = [];
  let totStk = 0;
  for (const acc of [accDeployer, ...accVoters]) {
    const addr = stdlib.formatAddress(acc).slice(0, 8);
    const stk = (await btok(acc, token)).toNumber();
    totStk = totStk + stk;
    t.push({ addr, stk });
  }
  t.push({ addr: "total", stk: totStk });
  console.table(t);
};

(async () => {
  console.log(`creating accounts`);

  const nVoters = 10;
  const bal = stdlib.parseCurrency(100);
  const accAdmin = await stdlib.newTestAccount(bal);
  const accDeployer = await stdlib.newTestAccount(bal);
  const accVoters = await stdlib.newTestAccounts(nVoters, bal);

  console.log(`launching tokens`);
  const VTK = await stdlib.launchToken(accAdmin, "Voting Token", "VTK");
  console.log(`VTK.id: ${VTK.id}`);

  for (const acc of [accDeployer, ...accVoters]) {
    for (const tok of [VTK]) {
      await acc.tokenAccept(tok.id);
    }
  }
  await balances(VTK, accDeployer, accVoters);

  console.log(`minting`);
  await VTK.mint(accDeployer, 10000);
  for (const acc of accVoters) {
    await VTK.mint(acc, 10);
  }

  await balances(VTK, accDeployer, accVoters);

  const ctcDeployer = accDeployer.contract(backend);
  const ctcVoters = accVoters.map((acc) =>
    acc.contract(backend, ctcDeployer.getInfo())
  );

  let resolveReadyForStakers = null;
  const pReadyForStakers = new Promise((r) => (resolveReadyForStakers = r));

  console.log(`Running deployer`);
  const pDeployer = ctcDeployer.p.Deployer({
    opts: {
      voteToken: VTK.id,
    },
    readyForStakers: () => resolveReadyForStakers(),
  });

  await ctcDeployer.getInfo();
  console.log(`ctc deployed`);

  await pReadyForStakers;
  console.log(`ready for voters`);

  const tryFn = async (lab, f, ...args) => {
    const maxTries = 3;
    let tries = 1;
    const msg = () =>
      `${lab} ${JSON.stringify(pretty(args))} after trying ${tries} time(s)`;
    let err = null;
    while (tries < maxTries) {
      try {
        const r = await f(...args);
        if (r.votingResult >= 0) {console.log("Issue: ", pretty(r))}
        console.log(msg());
        return r;
      } catch (e) {
        err = e;
        tries++;
      }
    }
    console.error(`Failed: ${msg()}`);
    throw err;
  };
  

  // API and functions declaration
  const tryApi = async (fname, verbed, i, ...args) =>
  await tryFn(
    `Voter #${i} ${verbed}`,
    ctcVoters[i].apis.Voter[fname],
    ...args
  );
  const tryAdminApi = async (fname, verbed, ...args) =>
  await tryFn(
    `Admin: ${verbed}`,
    ctcDeployer.apis.Voter[fname],
    ...args
  );

  // View
  const tryView = async (fname, ...args) => {
    const r = await tryFn(
      `Someone saw ${fname}`,
      ctcVoters[0].views[fname],
      ...args
    );
    console.log(pretty(r));
  };
  const tryViewFor = async (fname, i, ...args) => {
    const acc = ctcVoters[i];
    const r = await tryFn(
      `Voter #${i} saw ${fname}`,
      ctcVoters[i].views[fname],
      acc,
      ...args
    );
    console.log(pretty(r));
  };
  const tryAdminViewFor = async (fname, ...args) => {
    const acc = ctcVoters[i];
    const r = await tryFn(
      `Admin saw ${fname}`,
      ctcDeployer.views[fname],
      acc,
      ...args
    );
    console.log(pretty(r));
  };

  // Vote
  const tryVoteFor = async (i, amt) => {
    await tryApi("voteFor", "votedFor", i, amt);
    //await tryViewFor("voted", i);
  };
  const tryVoteAgainst = async (i, amt) => {
    await tryApi("voteAgainst", "votedAgainst", i, amt);
    //await tryViewFor("voted", i);
  };
  // Create Issue
  const tryCreateIssue = async (votesNeeded, votesPerc) => {
    await tryAdminApi("createIssue", "createdIssue", votesNeeded, votesPerc);
    //await tryViewFor("voted", i);
  };
  // Close Issue
  const tryVerifyIssue = async () => {
    await tryAdminApi("verifyResult", "closedIssue");
    //await tryAdminViewFor("voted");
  };
  
  await tryView("issueTotalVotes");
  await tryView("issueCreatorAdd");
  await tryView("issueVotesNeeded");
  await tryView("issueTotalVotesFor");
  await tryView("issueTotalVotesAgainst");
  await tryView("issueVotagePercentage");
  
  console.log("try Creating issue");
  await tryCreateIssue(15, 50, 10);
  console.log("Issue created")

  console.log("try Voting");

  await tryVoteFor(1, 10);
  await tryVoteAgainst(2, 5);
  await tryVoteFor(3, 10);
  let failed = false;
  try {
    await tryVoteAgainst(4, 1);
  } catch (e) {
    failed = true;
    console.error(`Voting has failed, voting closed`);
  }
  if (!failed) {
    console.error(`Voting was meant to fail`);
    await balances();
    process.exit(1);
  }
  let failed1 = false;
  try {
    await tryVoteFor(5, 1);
  } catch (e) {
    failed1 = true;
    console.error(`Voting has failed, voting closed`);
  }
  if (!failed1) {
    console.error(`Voting was meant to fail`);
    await balances();
    process.exit(1);
  }
  let failed2 = false;
  
  try {
    await tryVoteAgainst(6, 5);
  } catch (e) {
    failed2 = true;
    console.error(`Voting has failed, voting closed`);
  }
  if (!failed2) {
    console.error(`Voting was meant to fail`);
    await balances();
    process.exit(1);
  }

  console.log("Voting done");
  await tryView("issueTotalVotes");
  await tryView("issueCreatorAdd");
  await tryView("issueVotesNeeded");
  await tryView("issueTotalVotesFor");
  await tryView("issueTotalVotesAgainst");
  await tryView("issueVotagePercentage");

  await balances(VTK, accDeployer, accVoters);

  console.log("Closing voting");
  await tryVerifyIssue();


  await tryView("issueTotalVotes");
  await tryView("issueCreatorAdd");
  await tryView("issueVotesNeeded");
  await tryView("issueTotalVotesFor");
  await tryView("issueTotalVotesAgainst");
  await tryView("issueVotagePercentage");

  await balances(VTK, accDeployer, accVoters);
})();