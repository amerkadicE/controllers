"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenDetectionController = void 0;
// eslint-disable-next-line import/no-named-as-default
const abort_controller_1 = __importDefault(require("abort-controller"));
const BaseController_1 = require("../BaseController");
const util_1 = require("../util");
const constants_1 = require("../constants");
const __1 = require("..");
const DEFAULT_INTERVAL = 180000;
/**
 * Controller that passively polls on a set interval for Tokens auto detection
 */
class TokenDetectionController extends BaseController_1.BaseController {
    /**
     * Creates a TokenDetectionController instance.
     *
     * @param options - The controller options.
     * @param options.onTokensStateChange - Allows subscribing to tokens controller state changes.
     * @param options.onPreferencesStateChange - Allows subscribing to preferences controller state changes.
     * @param options.onNetworkStateChange - Allows subscribing to network controller state changes.
     * @param options.onTokenListStateChange - Allows subscribing to token list controller state changes.
     * @param options.getBalancesInSingleCall - Gets the balances of a list of tokens for the given address.
     * @param options.addDetectedTokens - Add a list of detected tokens.
     * @param options.getTokenListState - Gets the current state of the TokenList controller.
     * @param options.getTokensState - Gets the current state of the Tokens controller.
     * @param config - Initial options used to configure this controller.
     * @param state - Initial state to set on this controller.
     */
    constructor({ onTokensStateChange, onPreferencesStateChange, onNetworkStateChange, onTokenListStateChange, getBalancesInSingleCall, addDetectedTokens, getTokenListState, getTokensState, }, config, state) {
        super(config, state);
        /**
         * Name of this controller used during composition
         */
        this.name = 'TokenDetectionController';
        this.defaultConfig = {
            interval: DEFAULT_INTERVAL,
            networkType: constants_1.MAINNET,
            selectedAddress: '',
            tokens: [],
            disabled: true,
            chainId: __1.NetworksChainId.mainnet,
        };
        this.initialize();
        this.getTokensState = getTokensState;
        this.getTokenListState = getTokenListState;
        this.addDetectedTokens = addDetectedTokens;
        this.abortController = new abort_controller_1.default();
        onTokensStateChange(({ tokens }) => {
            this.configure({ tokens });
        });
        onPreferencesStateChange(({ selectedAddress, useTokenDetection }) => {
            const prevDisabled = this.config.disabled;
            const prevSelectedAddress = this.config.selectedAddress;
            const isTokenDetectionSupported = util_1.isTokenDetectionEnabledForNetwork(this.config.chainId);
            const isDetectionEnabled = useTokenDetection && isTokenDetectionSupported;
            this.configure({ selectedAddress, disabled: !isDetectionEnabled });
            // Check if detection state or selected address has changed
            if (isDetectionEnabled &&
                (prevDisabled || selectedAddress !== prevSelectedAddress)) {
                this.detectTokens();
            }
        });
        onNetworkStateChange((networkState) => __awaiter(this, void 0, void 0, function* () {
            if (this.config.chainId !== networkState.provider.chainId) {
                this.abortController.abort();
                this.abortController = new abort_controller_1.default();
                const incomingChainId = networkState.provider.chainId;
                const isTokenDetectionSupported = util_1.isTokenDetectionEnabledForNetwork(incomingChainId);
                const isDetectionEnabled = isTokenDetectionSupported && !this.config.disabled;
                this.configure({
                    networkType: networkState.provider.type,
                    chainId: incomingChainId,
                    disabled: !isDetectionEnabled,
                });
                if (isDetectionEnabled) {
                    yield this.restart();
                }
                else {
                    this.stopPolling();
                }
            }
        }));
        onTokenListStateChange(({ tokenList }) => {
            // Detect tokens when token list has been updated and is populated
            if (Object.keys(tokenList).length) {
                this.detectTokens();
            }
        });
        this.getBalancesInSingleCall = getBalancesInSingleCall;
    }
    /**
     * Start polling for the currency rate.
     */
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.config.disabled) {
                return;
            }
            yield this.startPolling();
        });
    }
    /**
     * Stop polling for the currency rate.
     */
    stop() {
        this.stopPolling();
    }
    /**
     * Restart polling for the token list.
     */
    restart() {
        return __awaiter(this, void 0, void 0, function* () {
            this.stopPolling();
            yield this.startPolling();
        });
    }
    stopPolling() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
    }
    /**
     * Starts a new polling interval.
     *
     * @param interval - An interval on which to poll.
     */
    startPolling(interval) {
        return __awaiter(this, void 0, void 0, function* () {
            interval && this.configure({ interval }, false, false);
            this.stopPolling();
            yield this.detectTokens();
            this.intervalId = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                yield this.detectTokens();
            }), this.config.interval);
        });
    }
    /**
     * Triggers asset ERC20 token auto detection for each contract address in contract metadata on mainnet.
     */
    detectTokens() {
        return __awaiter(this, void 0, void 0, function* () {
            /* istanbul ignore if */
            if (this.config.disabled) {
                return;
            }
            const tokensAddresses = this.config.tokens.map(
            /* istanbul ignore next*/ (token) => token.address.toLowerCase());
            const { tokenList } = this.getTokenListState();
            const tokensToDetect = [];
            for (const address in tokenList) {
                if (!tokensAddresses.includes(address)) {
                    tokensToDetect.push(address);
                }
            }
            const sliceOfTokensToDetect = [];
            sliceOfTokensToDetect[0] = tokensToDetect.slice(0, 1000);
            sliceOfTokensToDetect[1] = tokensToDetect.slice(1000, tokensToDetect.length - 1);
            const { selectedAddress } = this.config;
            /* istanbul ignore else */
            if (!selectedAddress) {
                return;
            }
            for (const tokensSlice of sliceOfTokensToDetect) {
                if (tokensSlice.length === 0) {
                    break;
                }
                yield util_1.safelyExecute(() => __awaiter(this, void 0, void 0, function* () {
                    const balances = yield this.getBalancesInSingleCall(selectedAddress, tokensSlice);
                    const tokensToAdd = [];
                    for (const tokenAddress in balances) {
                        let ignored;
                        /* istanbul ignore else */
                        const { ignoredTokens } = this.getTokensState();
                        if (ignoredTokens.length) {
                            ignored = ignoredTokens.find((ignoredTokenAddress) => ignoredTokenAddress === util_1.toChecksumHexAddress(tokenAddress));
                        }
                        const caseInsensitiveTokenKey = Object.keys(tokenList).find((i) => i.toLowerCase() === tokenAddress.toLowerCase()) || '';
                        if (ignored === undefined) {
                            tokensToAdd.push({
                                address: tokenAddress,
                                decimals: tokenList[caseInsensitiveTokenKey].decimals,
                                symbol: tokenList[caseInsensitiveTokenKey].symbol,
                                aggregators: tokenList[caseInsensitiveTokenKey].aggregators,
                            });
                        }
                    }
                    if (tokensToAdd.length) {
                        yield this.addDetectedTokens(tokensToAdd);
                    }
                }));
            }
        });
    }
}
exports.TokenDetectionController = TokenDetectionController;
exports.default = TokenDetectionController;
//# sourceMappingURL=TokenDetectionController.js.map