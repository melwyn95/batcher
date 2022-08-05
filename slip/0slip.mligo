#import "../commons/constants.mligo" "Constants"
#import "../commons/types.mligo" "CommonTypes"
#import "../commons/storage.mligo" "CommonStorage"
#import "../prices/prices.mligo" "Pricing"
#import "../treasury/treasury.mligo" "Treasury"
(* #import "../order_matching/order_match.mligo" "Matching" *)


(* Use common contract storage *)
type storage  = CommonStorage.Types.t

type result = (operation list) * storage

let no_op (s : storage) : result =  (([] : operation list), s)

(*
Entrypoints:
- Swap A of X token to Y token
- Update prices and expire orders
*)
type parameter =
  Swap of CommonTypes.Types.swap_order
| Post of CommonTypes.Types.exchange_rate

let add_swap_order (o : CommonTypes.Types.swap_order) (s : storage ) : result =
  let address = Tezos.sender in
  let rate = Pricing.Rates.get_rate (o) (s) in
  let deposited_token_amount : CommonTypes.Types.token_amount =  {
         token = o.swap.from;
         amount = o.from_amount;
     } in
  let deposit : CommonTypes.Types.deposit = {
     deposited_token_amount = deposited_token_amount;
     exchange_rate = rate;
  }  in
  let s = Treasury.Utils.deposit address deposit s in
  (* let s = Matching.pushOrder *)
  no_op (s)

let expire_orders (s : storage) : storage = s

let post_rate (r : CommonTypes.Types.exchange_rate) (s : storage) : result =
  let updated_rate_storage = Pricing.Rates.post_rate (r) (s) in
  no_op (updated_rate_storage)

let main
  (p, s : parameter * storage) : result =
  let s = expire_orders (s) in
  (* let s = Matching.tick (s) in *)
  match p with
   Swap (o) -> add_swap_order (o) (s)
   | Post(r) -> post_rate (r) (s)


