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
  const accDeployer = await stdlib.newTestAccount(bal);
  const accVoters = await stdlib.newTestAccounts(nVoters, bal);

  console.log(`launching tokens`);
  const VTK = await stdlib.launchToken(accDeployer, "Voting Token", "VTK");
  console.log(`VTK.id: ${VTK.id}`);

  for (const acc of [accDeployer, ...accVoters]) {
    for (const tok of [VTK]) {
      await acc.tokenAccept(tok.id);
    }
  }

  await balances(VTK, accDeployer, accVoters);

  console.log(`minting`);
  await VTK.mint(accDeployer, 1000);
  for (const acc of accVoters) {
    await VTK.mint(acc, 10);
  }

  await balances(VTK, accDeployer, accVoters);

  const ctcDeployer = accDeployer.contract(backend);
  const ctcVoters = accVoters.map((acc) =>
    acc.contract(backend, ctcDeployer.getInfo())
  );

  console.log(`Running deployer`);
  const pDeployer = ctcDeployer.p.Deployer({
    opts: {
      stakeToken: STK.id,
      rewardsPerBlock,
      duration,
    },
    readyForStakers: () => resolveReadyForStakers(),
  });
})();