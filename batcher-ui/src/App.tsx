import React, { useEffect, useState } from 'react';
import logo from './logo.svg';
import marigoldlogo from './marigoldlogo.png';
import ConnectButton from './ConnectWallet';
import { TezosToolkit } from '@taquito/taquito';
import DisconnectButton from './DisconnectWallet';
import DepositButton from './Deposit';
import RedeemButton from './Redeem';
import {  ContractsService, MichelineFormat, AccountsService, HeadService } from '@dipdup/tzkt-api';
import { parseISO, add, differenceInMinutes } from 'date-fns'
import './App.css';
import *  as model from "./Model";
import { Helmet } from 'react-helmet';
// reactstrap components
import {
  Card,
  CardHeader,
  CardBody,
  CardTitle,
  Table,
  Row,
  Col,
  CardFooter,
} from "reactstrap";
import { time } from 'console';


function App() {

  const [Tezos ] = useState<TezosToolkit>(new TezosToolkit(process.env["REACT_APP_TEZOS_NODE_URI"]!));
  const chain_api_url = process.env["REACT_APP_TZKT_URI_API"]!;
  const baseTokenName = "tzBTC";
  const baseTokenAddress = process.env["REACT_APP_TZBTC_HASH"]!;
  const baseTokenDecimals = 8;
  const quoteTokenName ="USDT";
  const quoteTokenAddress = process.env["REACT_APP_USDT_HASH"]!;
  const quoteTokenDecimals = 6;
  const [wallet, setWallet] = useState<any>(null);
  const [userAddress, setUserAddress] = useState<string>("No Wallet Connected");
  const [refreshRate ] = useState<number>(10000);
  const mainPanelRef = React.useRef(null);
  const [exchangeRate, setExchangeRate] = useState<number | undefined>();
  const [remaining, setRemaining] = useState<string>("No open batch");
  const [orderBook, setOrderBook] = useState<model.order_book | undefined>(undefined);
  const [previousBatches, setPreviousBatches] = useState<Array<model.batch>>([]);
  const [numberOfBids, setNumberOrBids] = useState<number>(0);
  const [numberOfAsks, setNumberOrAsks] = useState<number>(0);
  const [contractAddress] = useState<string>(process.env["REACT_APP_BATCHER_CONTRACT_HASH"]!);
  const baseToken :  model.token = {name : baseTokenName, address : baseTokenAddress, decimals : baseTokenDecimals};
  const [baseTokenBalance, setBaseTokenBalance] = useState<number>(0);
  const [baseTokenTolerance, setBaseTokenTolerance] = useState<number>(1);
  const quoteToken :  model.token = {name : quoteTokenName, address : quoteTokenAddress, decimals : quoteTokenDecimals};
  const [quoteTokenBalance, setQuoteTokenBalance] = useState<number>(0);
  const [quoteTokenTolerance, setQuoteTokenTolerance] = useState<number>(1);
  const [invertedTokenPair ] = useState<string>(""+baseTokenName+"/"+quoteTokenName);
  const [tokenBalanceUri, setTokenBalanceUri] = useState<string>("");
  const [bigMapByIdUri, setBigMapByIdUri] = useState<string>("");
  const contractsService = new ContractsService( {baseUrl: chain_api_url , version : "", withCredentials : false});

  const rationalise_rate = (rate: number, pow: number, baseDecimals: number, quoteDecimals: number) => {
    let scale = Number(pow) + Number(baseDecimals) - Number(quoteDecimals);
    return Number(rate) * Math.pow(10, scale);
  }



  const get_time_left_in_batch = ( status:string) => {
    console.log(status);
    let statusObject = JSON.parse(status);
    console.log(statusObject);
    if(status.search("closed") > -1){
        let close = parseISO(statusObject.closed.closing_time);
        return "Batch was closed at " + close;
    } else if (status.search("open") > -1){
      let now = new Date();
      let open = parseISO(statusObject.open);
      let batch_close = add(open,{ minutes: 10})
      let diff = differenceInMinutes(batch_close, now);
      let rem = "";
      if (diff <= 0) {
         rem = "0"
        } else {
          rem = "" + diff
        };
       return ""+rem+" minutes" ;
    } else if (status.search("cleared")) {
        let cleared = parseISO(statusObject.cleared.at);
        return "Batch was cleared at " + cleared;
    }
     else {
        return "No open batch";
    }


  }

  const  rationaliseAmount = (amount: number, decimals: number) => {
     let scale =10 ** (-decimals);
     return amount * scale
  };

  const get_token_by_side = (decimals: number, tolerance : string, order_sides : Array<model.swap_order>) => {
    try{
    let token_name = order_sides[0].swap.from.token.name;

    let amount = order_sides.reduce((previousAmount, order) => {
      if (Object.keys(order.tolerance)[0] === tolerance) {
        previousAmount += Number(order.swap.from.amount);
      }

      return previousAmount;
    }, 0);
    let corrected_amount = rationaliseAmount(amount, decimals);
    return token_name.concat(" : ", Number(corrected_amount).toString());
  }
  catch (error){
    return 0;
  }
  }



  const update_from_storage = async () => {
    console.log("Updating storage");
    const storage = await contractsService.getStorage( { address : contractAddress, level: 0, path: null } );
    const rates_map_keys = await contractsService.getBigMapByNameKeys( { address : contractAddress, name: "rates_current", micheline: MichelineFormat.JSON } )
    console.log(rates_map_keys);
    if (rates_map_keys.length != 0) {
      const exchange_rate : model.exchange_rate = rates_map_keys.filter(r => r.key == invertedTokenPair)[0].value;
      const scaled_rate = rationalise_rate(exchange_rate.rate.val, exchange_rate.rate.pow, exchange_rate.swap.from.token.decimals, exchange_rate.swap.to.decimals);
      setExchangeRate(scaled_rate);
      console.log("Updated Exchange Rate");
    }

    if (storage.batches.current) {
      const current_batch_status = storage.batches.current.status;
      let time_remaining = get_time_left_in_batch(JSON.stringify(current_batch_status));
      setRemaining(time_remaining);

      const order_book : model.order_book = storage.batches.current.orderbook;
      setOrderBook(order_book);
      setNumberOrBids(order_book.bids.length);
      setNumberOrAsks(order_book.asks.length);
    }

    if (storage.batches.previous) {
      setPreviousBatches(storage.batches.previous);
    }
  };


  const updateUriSettings = async (): Promise<void> => {
   try{
      console.log("Updating Token Balance URI");
      if (userAddress != "No Wallet Connected") {
        setTokenBalanceUri("" + chain_api_url + "/v1/tokens/balances?account=" + userAddress);
        setBigMapByIdUri("" + chain_api_url + "/v1/bigmaps/");
      }
   } catch (error)
   {
      console.log(error);
   }

  }

  useEffect(() => {
      (async () => updateUriSettings())();
  }, [userAddress])

  const updateValues = async (): Promise<void> => {
    try {
      await update_from_storage();
    } catch (error) {
      console.log(error);
    }
  };



  useEffect(() => {

      (async () => updateValues())();
    const interval=setInterval(()=>{
      (async () => updateValues())();
     },refreshRate)

     return()=>clearInterval(interval)


  }, [tokenBalanceUri])

  return (


          <div className="wrapper">
            <div className="main-panel" ref={mainPanelRef} >

            <Helmet>
                <meta charSet="utf-8" />
                <title>Batcher</title>
                <link rel="canonical" href="http://batcher.marigold.dev" />
            </Helmet>
      <div className="content">
        <Row  className="pr-5 mr-3">
          <Col>
            <Card >
              <CardHeader>
                  <Col className="text-left float-left" sm="4">
                    <CardTitle tag="h1"><img src={logo} height="150" alt="logo"/></CardTitle>
                  </Col>
                  <Col className="text-right float-right" sm="4">
                    <CardTitle tag="h1"><img src={marigoldlogo} height="150" alt="logo"/></CardTitle>
                    </Col>
                </CardHeader>
                <CardBody>
                </CardBody>
              </Card>
            </Col>
          </Row>

        <Row>
          <Col sm="8">
              <Card>
              <CardHeader>
                <h4 className="title d-inline">POOL: tzBTC / USDT</h4>
              </CardHeader>
              <CardBody>
                <h4 className="title d-inline">Current Batch</h4>
                  <Row className="sm-5 sp-5">
                  <Col>
                  <Row>
                    <Col className="sm-0"><h6 className="title d-inline">Oracle Price</h6></Col>
                  </Row>
                 <Row>
                    <Col className="sm-1">{ exchangeRate } </Col>
                 </Row>
                  </Col>
                  <Col>
                  <Row>
                    <Col className="sm-0"><h6 className="title d-inline">Time Remaining</h6></Col>
                  </Row>
                 <Row>
                    <Col className="sm-0">{ remaining }</Col>
                 </Row>
                  </Col>
                  <Col>
                  <Row>
                    <Col className="sm-0"><h6 className="title d-inline">Bids Orders</h6></Col>
                  </Row>
                 <Row>
                    <Col className="sm-0">{ numberOfBids }</Col>
                 </Row>
                  </Col>
                  <Col>
                  <Row>
                    <Col className="sm-0"><h6 className="title d-inline">Ask Orders</h6></Col>
                  </Row>
                 <Row>
                    <Col className="sm-0">{ numberOfAsks }</Col>
                 </Row>
                  </Col>
                  </Row>
              </CardBody>
              <CardFooter>

              </CardFooter>
            </Card>
            <DepositButton
                Tezos={Tezos}
                setWallet={setWallet}
                setUserAddress={setUserAddress}
                setTokenBalance={setBaseTokenBalance}
                setTokenTolerance={setBaseTokenTolerance}
                token={baseToken}
                tokenAddress={baseTokenAddress}
                tokenBalance={baseTokenBalance}
                tokenTolerance={baseTokenTolerance}
                contractAddress={contractAddress}
                tokenBalanceUri={tokenBalanceUri}
                orderSide={0}
                toToken={quoteToken}
                wallet={wallet}
            />
             <DepositButton
                Tezos={Tezos}
                setWallet={setWallet}
                setUserAddress={setUserAddress}
                setTokenBalance={setQuoteTokenBalance}
                setTokenTolerance={setQuoteTokenTolerance}
                token={quoteToken}
                tokenAddress={quoteTokenAddress}
                tokenBalance={quoteTokenBalance}
                tokenTolerance={quoteTokenTolerance}
                contractAddress={contractAddress}
                tokenBalanceUri={tokenBalanceUri}
                orderSide={1}
                toToken={baseToken}
                wallet={wallet}
            />
            <Row>
            </Row>
          </Col>
          <Col className="position-relative" sm="3">
            <Row>
            <Card sm="5.5">
            <CardHeader>
                <h4 className="title d-inline">Wallet</h4>
              </CardHeader>
              <CardBody>
              <Row className="sm-5 sp-5">
                  <Col>
                    <Row>
                    <Col className="col-4"><h6 className="title d-inline">User Address</h6></Col>
                    </Row>
                   <Row>
                      <Col className="sm-1">{ userAddress } </Col>
                    </Row>
                    </Col>
               </Row>
              <Row className="mt-4 sp-5">
                  <Col>
                <ConnectButton
                  Tezos={Tezos}
                  setWallet={setWallet}
                  setUserAddress={setUserAddress}
                  userAddress={userAddress}
                  wallet={wallet}
                />
                  </Col>
                  <Col>
               <DisconnectButton
               wallet={wallet}
               setUserAddress={setUserAddress}
               userAddress={userAddress}
               setWallet={setWallet}
               />
                  </Col>
               </Row>
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <h4 className="title">Order Book</h4>
              </CardHeader>
              <CardBody>
                 <Row>
                   <Col>
                    <h4 className="title d-inline">Bids</h4>
                      <Row>
                        <Col className="col-4"><h6 className="title d-inline">-10bps</h6></Col>
                        <Col className="px-sm-0">{(orderBook == undefined) ? 0 : get_token_by_side(baseToken.decimals, "mINUS", orderBook?.bids!)}</Col>
                      </Row>
                      <Row>
                        <Col className="col-4"><h6 className="title d-inline">EXACT</h6></Col>
                        <Col className="px-sm-0">{(orderBook == undefined) ? 0 : get_token_by_side(baseToken.decimals,"eXACT", orderBook?.bids!)}</Col>
                      </Row>
                      <Row>
                        <Col className="col-4"><h6 className="title d-inline">+10bps</h6></Col>
                        <Col className="px-sm-0">{(orderBook == undefined) ? 0 : get_token_by_side(baseToken.decimals,"pLUS", orderBook?.bids!)}</Col>
                      </Row>

                   </Col>
                   <Col>
                    <h4 className="title d-inline">Asks</h4>
                    <Row>
                        <Col className="col-4"><h6 className="title d-inline">-10bps</h6></Col>
                        <Col className="px-sm-0">{(orderBook == undefined) ? 0 : get_token_by_side(quoteToken.decimals,"mINUS", orderBook?.asks!)}</Col>
                      </Row>
                      <Row>
                        <Col className="col-4"><h6 className="title d-inline">EXACT</h6></Col>
                        <Col className="px-sm-0">{(orderBook == undefined) ? 0 : get_token_by_side(quoteToken.decimals,"eXACT", orderBook?.asks!)}</Col>
                      </Row>
                      <Row>
                        <Col className="col-4"><h6 className="title d-inline">+10bps</h6></Col>
                        <Col className="px-sm-0">{(orderBook == undefined) ? 0 : get_token_by_side(quoteToken.decimals,"pLUS", orderBook?.asks!)}</Col>
                      </Row>

                   </Col>
                 </Row>
              </CardBody>
              <CardFooter>
              </CardFooter>
            </Card>
            </Row>
            <Row>


             <RedeemButton
                Tezos={Tezos}
                token={quoteToken}
                previousBatches={previousBatches}
                userAddress={userAddress}
                toToken={baseToken}
                wallet={wallet}
                contractAddress={contractAddress}
                bigMapsById={bigMapByIdUri}
            />

            </Row>
          </Col>
        </Row>
 </div>      </div>
            </div>


  );
}

export default App;
