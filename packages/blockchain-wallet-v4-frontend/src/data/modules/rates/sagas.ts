import { and, compose, head, last, prop } from 'ramda'
import { call, put, select } from 'redux-saga/effects'

import * as A from './actions'
import * as S from './selectors'
import { actions, selectors } from 'data'
import { configEquals, splitPair } from './model'

export default ({ api }) => {
  const subscribeToAdvice = function * ({
    payload
  }: ReturnType<typeof A.subscribeToAdvice>) {
    try {
      const { pair, volume, fix, fiatCurrency } = payload

      yield put(A.updatePairConfig(pair, volume, fix, fiatCurrency))
      yield put(
        actions.middleware.webSocket.rates.openAdviceChannel(
          pair,
          volume,
          fix,
          fiatCurrency
        )
      )
    } catch (e) {}
  }

  const unsubscribeFromAdvice = function * ({
    payload
  }: ReturnType<typeof A.unsubscribeFromAdvice>) {
    const { pair } = payload

    yield put(actions.middleware.webSocket.rates.closeAdviceChannel(pair))
  }

  const subscribeToRates = function * ({
    payload
  }: ReturnType<typeof A.subscribeToRates>) {
    const { pairs } = payload

    yield put(actions.middleware.webSocket.rates.closeRatesChannel())
    yield put(actions.middleware.webSocket.rates.openRatesChannel(pairs))
  }

  const unsubscribeFromRates = function * () {
    yield put(actions.middleware.webSocket.rates.closeRatesChannel())
  }

  const fetchAvailablePairs = function * () {
    try {
      yield put(A.availablePairsLoading())
      const { pairs } = yield call(api.fetchAvailablePairs)
      const getCoinAvailability = yield select(
        selectors.core.walletOptions.getCoinAvailability
      )
      const getExchangeTypeAvailability = (type, coin) =>
        getCoinAvailability(coin)
          .map(prop(type))
          .getOrElse(false)

      const walletAvailablePairs = pairs.filter(
        compose(
          coins =>
            and(
              getExchangeTypeAvailability('exchangeTo', last(coins)),
              getExchangeTypeAvailability('exchangeFrom', head(coins))
            ),
          splitPair
        )
      )
      yield put(A.availablePairsSuccess(walletAvailablePairs))
    } catch (e) {
      yield put(A.availablePairsError(e))
    }
  }

  const updateAdvice = function * ({
    payload: { quote }
  }: ReturnType<typeof A.updateAdvice>) {
    const { pair, fix, volume, fiatCurrency } = quote
    const currentConfig = yield select(S.getPairConfig(pair))
    if (configEquals(currentConfig, { fix, volume, fiatCurrency })) {
      yield put(A.setPairQuote(pair, quote))
      yield put(A.pairUpdated(pair))
    }
  }

  return {
    subscribeToAdvice,
    unsubscribeFromAdvice,
    fetchAvailablePairs,
    updateAdvice,
    subscribeToRates,
    unsubscribeFromRates
  }
}