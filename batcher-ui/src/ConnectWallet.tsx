import { Dispatch, SetStateAction, useState, useEffect } from "react";
import { TezosToolkit } from "@taquito/taquito";
import { BeaconWallet } from "@taquito/beacon-wallet";
import './App.css';
import toast, { Toaster } from 'react-hot-toast';
import {
  NetworkType
} from "@airgap/beacon-sdk";

// reactstrap components
import {
  Button
} from "reactstrap";

type ButtonProps = {
  Tezos: TezosToolkit;
  setWallet: Dispatch<SetStateAction<any>>;
  setUserAddress: Dispatch<SetStateAction<string>>;
  setUserBalance: Dispatch<SetStateAction<number>>;
  userAddress: string;
  wallet: BeaconWallet;
};

const ConnectButton = ({
  Tezos,
  setWallet,
  setUserAddress,
  setUserBalance,
  userAddress,
  wallet
}: ButtonProps): JSX.Element => {

  const setup = async (userAddress: string): Promise<void> => {
    setUserAddress(userAddress);
    // updates balance
    const balance = await Tezos.tz.getBalance(userAddress);

    setUserBalance(balance.toNumber());
    toast.success('Wallet for address ' + userAddress + ' connected')
  };

  const connectWallet = async (): Promise<void> => {
    try {
      if(!wallet) await createWallet();
      await wallet.requestPermissions({
        network: {
          type: NetworkType.JAKARTANET ,
          rpcUrl: "https://jakartanet.tezos.marigold.dev"
        }
      });
      // gets user's address
      const userAddress = await wallet.getPKH();
      await setup(userAddress);
    } catch (error) {
      console.log(error);
    }
  };

  const createWallet = async() => {
    // creates a wallet instance if not exists
    if(!wallet){
      wallet = new BeaconWallet({
      name: "batcher",
      preferredNetwork: NetworkType.JAKARTANET
    });}
    Tezos.setWalletProvider(wallet);
    setWallet(wallet);
    // checks if wallet was connected before
    const activeAccount = await wallet.client.getActiveAccount();
    if (activeAccount) {
      const userAddress = await wallet.getPKH();
      await setup(userAddress);
    }
  }

  useEffect(() => {
    (async () => createWallet())();
  }, []);

  return (
      <Button block active={userAddress == "" ? true : false } className="btn-success" size="sm" onClick={connectWallet}>
          Connect
      </Button>
  );
};

export default ConnectButton;
