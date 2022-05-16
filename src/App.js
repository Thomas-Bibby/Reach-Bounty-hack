import React, { useEffect, useState } from "react";
import logo from "./logo.svg";
import "./App.css";
import AlgoConnect from "./components/AlgoConnect.jsx";
import * as backend from "./build/index.main.mjs";
import {
  loadStdlib,
  ALGO_MyAlgoConnect as MyAlgoConnect,
} from "@reach-sh/stdlib";
import pretty from "./pretty.js";
import "bootstrap/dist/css/bootstrap.min.css";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const reach = loadStdlib("ALGO");

reach.setWalletFallback(
  reach.walletFallback({
    providerEnv: "MainNet",
    MyAlgoConnect,
  })
);

function App() {
  const [upDatevalues, setUpDatevalues] = useState(0);
  const [votesNeeded, setVotesNeeded] = useState(0);
  const [votesPerc, setVotesPerc] = useState(0);
  const [amount, setAmount] = useState(0);
  const [bal, setBal] = useState(reach.parseCurrency(100));
  const [account, setAccount] = useState(0);
  const [ctc, setCtc] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [govTokensAmt, setGovTokensAmt] = useState(0);
  const [currentGovTokenPool, setCurrentGovTokenPool] = useState(0);

  // Voting status
  const [issuePending, setIssuePending] = useState(true);
  const [issueSuccessfull, setIssueSuccessfull] = useState(true);
  const [issueFail, setIssueFail] = useState(true);
  const [issueClosed, setIssueClosed] = useState(true);

  // UI values
  const [totalVotes, setTotalVotes] = useState(0);
  const [votingAccPerc, setVotingAccPerc] = useState(0);

  const [userBalance, setUserBalance] = useState(0);
  const [usersClaimable, setUsersClaimable] = useState(0);

  const [issueTotalVotes, setIssueTotalVotes] = useState(0);

  // contract variables
  const [ctcInfoStr, setCtcInfoStr] = useState(
    `{ "type": "BigNumber", "hex": "${process.env.REACT_APP_CTCINFOSTRINGHEX}" }`
  );
  const [votingToken, setStakingToken] = useState(
    `{ "type": "BigNumber", "hex": "${process.env.REACT_APP_TOKENIDHEX}" }`
  );

  useEffect(() => {
    async function updateUserDetails() {
      if (account != 0 && votingToken != undefined) {
        const tmpBalance = await reach.balanceOf(
          account,
          ctcparse(votingToken)
        );
        setUserBalance(Number(tmpBalance) / 1000000);

        if (tmpBalance <= 100) {
          const tmpClaimable = 100 - tmpBalance;
          setUsersClaimable(tmpClaimable);
        }
      }
    }
    updateUserDetails();
  }, [upDatevalues, account, votingToken]);

  const connectWallet = async (platform) => {
    const tmpAcc = await reach.getDefaultAccount();
    // await reach.fundFromFaucet(tmpAcc, reach.parseCurrency(bal));
    setAccount(tmpAcc);

    await tmpAcc.tokenAccept(ctcparse(votingToken));

    // await votingToken.mint(tmpAcc, 100);

    const tmpctc = tmpAcc.contract(backend, ctcparse(ctcInfoStr));

    setCtc(tmpctc);
    setUpDatevalues(upDatevalues + 1);

    if (tmpAcc.networkAccount.addr === process.env.REACT_APP_ADMINADDRESS) {
      setIsAdmin(true);
    }

    await _refreshInfo(tmpAcc, tmpctc);
  };

  const ctcparse = (s) => {
    try {
      return JSON.parse(s);
    } catch (e) {
      return s;
    }
  };

  async function _refreshInfo(acc, accCtc) {
    const runView = async (vname, ...args) => {
      const res = await accCtc.views[vname](...args);
      if (res[0] != "Some") {
        console.warn(vname, res);
        return;
      }
      return pretty(res);
    };
    const runViews = async (vs) => {
      const data = {};
      const promises = [];
      for (const [vname, ...args] of vs) {
        const p = (async () => {
          const res = await runView(vname, ...args);
          data[vname] = res;
        })();
        promises.push(p);
        // For some reason we *do* need to perform these queries serially,
        // or else they all come back None. =[
        await p;
      }
      await Promise.all(promises);
      return data;
    };
    const now = pretty(await reach.getNetworkTime());
    const data = {
      ...(await runViews([
        ["opts"],
        ["issueTotalVotes"],
        ["issueCreatorAdd"],
        ["issueVotesNeeded"],
        ["issueTotalVotesFor"],
        ["issueTotalVotesAgainst"],
        ["issueVotagePercentage"],
        ["issue"],
        ["voted", acc],
        ["IssueVotagePercentageRequired"],
        ["GovernanceTokenPool"],
      ])),
      now,
    };
    setIssueTotalVotes(data.issueTotalVotes / 1000000);
    setVotingAccPerc(data.issueVotagePercentage);
    setCurrentGovTokenPool(data.GovernanceTokenPool / 1000000);

    if (
      (Number(data.issueTotalVotes) != 0 &&
        Number(data.issueVotesNeeded) != 0) ||
      Number(data.IssueVotagePercentageRequired) != 0
    ) {
      setIssuePending(false);
      setIssueSuccessfull(true);
      setIssueClosed(true);
      setIssueFail(true);
      if (Number(data.issueTotalVotes) >= Number(data.issueVotesNeeded)) {
        setIssuePending(true);
        if (
          Number(data.issueVotagePercentage) >=
          Number(data.IssueVotagePercentageRequired)
        ) {
          setIssueSuccessfull(false);
        } else {
          setIssueFail(false);
          setIssuePending(true);
          setIssueSuccessfull(true);
          setIssueClosed(true);
        }
      }
    } else {
      setIssueClosed(false);
    }

    if (issueClosed == false) {
      setIssueSuccessfull(true);
    }

    console.log("data", data);
  }

  const inputChange = function (value) {
    setAmount(value);
  };

  const voteFor = async () => {
    if (issuePending === false) {
      await _api("voteFor", amount * 1000000);
      toast.success("Vote for the issue successful");
    } else {
      toast.error("Voting has closed");
    }
  };

  const voteAgainst = async () => {
    if (issuePending === false) {
      await _api("voteAgainst", amount * 1000000);
      toast.success("Vote against the issue successful");
    } else {
      toast.error("Voting has closed");
    }
  };

  const createIssue = async () => {
    await _api("createIssue", votesNeeded * 1000000, votesPerc);
    toast.success("Issue created successfully");
  };

  const verifyIssue = async () => {
    await _api("verifyResult");
    toast.success("Issue verified");
  };

  async function _api(name, ...args) {
    console.log(`calling api: ${name}`);
    const res = await ctc.apis.Voter[name](...args);
    console.log(pretty(res));
    await _refreshInfo(account, ctc);
    setUpDatevalues(upDatevalues + 1);
  }

  const claimTokens = async () => {
    await _api("claimGovernanceTokens");
    toast.success("Tokens claimed");
  };

  const addGovernanceTokens = async () => {
    await _api("AddToGovernancePool", govTokensAmt);
    toast.success("Tokens added");
  };

  const inputChangeVotesNeeded = async (value) => {
    setVotesNeeded(value);
  };

  const inputChangeVotesPer = async (value) => {
    setVotesPerc(value);
  };

  const inputChangeAddGovTok = async (value) => {
    setGovTokensAmt(value * 1000000);
  };

  return (
    <div className="App">
      <div className="titleBackcolour">
        <h1>Algo Governance - Reach Bounty Hack</h1>
        <h6>By Jack Betson and Thomas Bibby</h6>
      </div>

      <div className="row justify-content-center mx-0">
        <h3>
          Current Issue
          <span hidden={issuePending} style={{ color: "" }}>
            {" "}
            - Pending
          </span>
          <span hidden={issueSuccessfull} style={{ color: "green" }}>
            {" "}
            - Successful
          </span>
          <span hidden={issueFail} style={{ color: "red" }}>
            {" "}
            - Unsuccessful
          </span>
          <span hidden={issueClosed} style={{ color: "black" }}>
            {" "}
            - Closed
          </span>
        </h3>
        <div className="col-sm-4 col-12">
          <div className="value mx-0 px-0">
            {issueTotalVotes}
            &nbsp;
            {process.env.REACT_APP_TOKENSYMBOL}
          </div>
          <div className="valueTitle">Total Votes</div>
        </div>
        <div className="col-sm-4 col-12 mt-sm-0 mt-3">
          <div className="value">
            {votingAccPerc}
            &nbsp;
            {process.env.REACT_APP_TOKENSYMBOL}
          </div>
          <div className="valueTitle">Voting percentage</div>
        </div>
      </div>

      <div
        id="stakeCard"
        className="card mb-4 mx-auto"
        style={{ maxWidth: "550px" }}
      >
        <div className="card-body row justify-content-center">
          <div className="col-11">
            <div className="row">
              <span id="walletBalance" className="col">
                Wallet Balance:&nbsp; {userBalance} (VTK)
              </span>
            </div>

            <div className="input-group col align-self-end">
              <input
                className="form-control form-control-lg stakeAmountInput"
                id="stakeAmountInput"
                // {...register("amount")}
                type="number"
                step="0.0001"
                placeholder="0"
                onChange={(e) => inputChange(e.currentTarget.value)}
              />
            </div>

            <div className="row">
              <div className="col-11"></div>
              <div className="col-11"></div>

              {account == 0 && (
                <div className="col">
                  <AlgoConnect connectWallet={connectWallet} />
                </div>
              )}

              {account != 0 && (
                <div className="col">
                  <button
                    className="btn btn-block stakeCardBtn"
                    onClick={() => voteFor()}
                  >
                    Vote For
                  </button>
                </div>
              )}

              {account != 0 && (
                <div className="col">
                  <button
                    className="btn btn-block stakeCardBtn"
                    onClick={() => voteAgainst()}
                  >
                    Vote Against
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div>
        <div id="ClaimGovernanceTokens">
          <h3>Claim Governance Tokens</h3>
          <div className="row justify-content-center">
            <div className="col-sm-4 col-12">
              <p>Claimable Amount: {usersClaimable}</p>
            </div>
            <div>
              <button
                className="btn btn-block stakeCardBtn"
                onClick={() => claimTokens()}
              >
                Claim tokens
              </button>
            </div>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div>
          <div id="ClaimGovernanceTokens">
            <h3>Admin UI</h3>
            <div className="row justify-content-center">
              <div className="col-sm-4 col-12">
                <p>Votes needed: </p>
                <input
                  onChange={(e) =>
                    inputChangeVotesNeeded(e.currentTarget.value)
                  }
                ></input>
              </div>
              <div className="col-sm-4 col-12">
                <p>Votes Percentage: </p>
                <input
                  onChange={(e) => inputChangeVotesPer(e.currentTarget.value)}
                ></input>
              </div>
              <div>
                <button
                  className="btn btn-block stakeCardBtn"
                  onClick={() => createIssue()}
                >
                  Create Issue
                </button>
                <button
                  className="btn btn-block stakeCardBtn"
                  onClick={() => verifyIssue()}
                >
                  Verify Issue
                </button>
              </div>
              <div className="col-sm-4 col-12">
                <p>Add to Gov Token Pool ({currentGovTokenPool} VTK): </p>
                <input
                  onChange={(e) => inputChangeAddGovTok(e.currentTarget.value)}
                ></input>
                <button
                  className="btn btn-block stakeCardBtn"
                  onClick={() => addGovernanceTokens()}
                >
                  Add to pool
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
