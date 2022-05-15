import React from "react";
import "../App.css";

function AlgoConnect({ connectWallet }) {
  return <button className="btn btn-block stakeCardBtn" onClick={connectWallet}>Algo Connect</button>;
}

export default AlgoConnect;
