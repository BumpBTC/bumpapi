;; Define constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-enough-balance (err u101))
(define-constant err-no-stake (err u102))
(define-constant err-already-staked (err u103))

;; Define data vars
(define-data-var total-staked uint u0)
(define-data-var staking-enabled bool true)

;; Define data maps
(define-map user-stakes principal { amount: uint, reward: uint })
(define-map user-last-stake-time principal uint)

;; Friedger pool contract
(define-constant friedger-pool 'ST2ZRX0K27GW0SP3GJCEMHD95TQGJMKB7G9Y0X1MH.friedger-pool-v1)

;; Read-only functions

(define-read-only (get-total-staked)
  (var-get total-staked)
)

(define-read-only (get-user-stake (user principal))
  (default-to { amount: u0, reward: u0 } (map-get? user-stakes user))
)

(define-read-only (get-user-last-stake-time (user principal))
  (default-to u0 (map-get? user-last-stake-time user))
)

(define-read-only (is-staking-enabled)
  (var-get staking-enabled)
)

;; Private functions

(define-private (calculate-reward (stake-amount uint) (time-elapsed uint))
  ;; Simple reward calculation: 10% APY
  (/ (* stake-amount time-elapsed) u3650)
)

;; Public functions

(define-public (stake (amount uint))
  (let (
    (user-stake (get-user-stake tx-sender))
    (current-time block-height)
  )
    (asserts! (is-staking-enabled) (err u104))
    (asserts! (>= (stx-get-balance tx-sender) amount) err-not-enough-balance)
    (asserts! (is-eq (get user-stake 'amount) u0) err-already-staked)
    
    (try! (stx-transfer? amount tx-sender friedger-pool))
    (var-set total-staked (+ (var-get total-staked) amount))
    (map-set user-stakes tx-sender { amount: amount, reward: u0 })
    (map-set user-last-stake-time tx-sender current-time)
    
    (ok amount)
  )
)

(define-public (unstake)
  (let (
    (user-stake (get-user-stake tx-sender))
    (stake-amount (get user-stake 'amount))
    (last-stake-time (get-user-last-stake-time tx-sender))
    (current-time block-height)
    (time-elapsed (- current-time last-stake-time))
    (reward (calculate-reward stake-amount time-elapsed))
  )
    (asserts! (> stake-amount u0) err-no-stake)
    
    (try! (as-contract (contract-call? friedger-pool withdraw-stx stake-amount tx-sender)))
    (var-set total-staked (- (var-get total-staked) stake-amount))
    (map-delete user-stakes tx-sender)
    (map-delete user-last-stake-time tx-sender)
    
    (try! (as-contract (stx-transfer? reward (as-contract tx-sender) tx-sender)))
    
    (ok { unstaked: stake-amount, reward: reward })
  )
)

(define-public (claim-reward)
  (let (
    (user-stake (get-user-stake tx-sender))
    (stake-amount (get user-stake 'amount))
    (last-stake-time (get-user-last-stake-time tx-sender))
    (current-time block-height)
    (time-elapsed (- current-time last-stake-time))
    (reward (calculate-reward stake-amount time-elapsed))
  )
    (asserts! (> stake-amount u0) err-no-stake)
    
    (map-set user-last-stake-time tx-sender current-time)
    (map-set user-stakes tx-sender { amount: stake-amount, reward: u0 })
    
    (try! (as-contract (stx-transfer? reward (as-contract tx-sender) tx-sender)))
    
    (ok reward)
  )
)

;; Admin functions

(define-public (set-staking-enabled (enabled bool))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (ok (var-set staking-enabled enabled))
  )
)

(define-public (withdraw-fees (amount uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (as-contract (stx-transfer? amount (as-contract tx-sender) tx-sender))
  )
)