import { BaseController, BaseConfig, BaseState } from '../BaseController';
import type { NetworkState, NetworkType } from '../network/NetworkController';
import type { PreferencesState } from '../user/PreferencesController';
import type { TokensController, TokensState } from './TokensController';
import type { AssetsContractController } from './AssetsContractController';
import { Token } from './TokenRatesController';
import { TokenListState } from './TokenListController';
/**
 * @type TokenDetectionConfig
 *
 * TokenDetection configuration
 * @property interval - Polling interval used to fetch new token rates
 * @property networkType - Network type ID as per net_version
 * @property selectedAddress - Vault selected address
 * @property tokens - List of tokens associated with the active vault
 */
export interface TokenDetectionConfig extends BaseConfig {
    interval: number;
    networkType: NetworkType;
    selectedAddress: string;
    tokens: Token[];
    chainId: string;
}
/**
 * Controller that passively polls on a set interval for Tokens auto detection
 */
export declare class TokenDetectionController extends BaseController<TokenDetectionConfig, BaseState> {
    private intervalId?;
    /**
     * Name of this controller used during composition
     */
    name: string;
    private getBalancesInSingleCall;
    private addDetectedTokens;
    private getTokensState;
    private getTokenListState;
    private abortController;
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
    constructor({ onTokensStateChange, onPreferencesStateChange, onNetworkStateChange, onTokenListStateChange, getBalancesInSingleCall, addDetectedTokens, getTokenListState, getTokensState, }: {
        onTokensStateChange: (listener: (tokensState: TokensState) => void) => void;
        onPreferencesStateChange: (listener: (preferencesState: PreferencesState) => void) => void;
        onNetworkStateChange: (listener: (networkState: NetworkState) => void) => void;
        onTokenListStateChange: (listener: (tokenListState: TokenListState) => void) => void;
        getBalancesInSingleCall: AssetsContractController['getBalancesInSingleCall'];
        addDetectedTokens: TokensController['addDetectedTokens'];
        getTokenListState: () => TokenListState;
        getTokensState: () => TokensState;
    }, config?: Partial<TokenDetectionConfig>, state?: Partial<BaseState>);
    /**
     * Start polling for the currency rate.
     */
    start(): Promise<void>;
    /**
     * Stop polling for the currency rate.
     */
    stop(): void;
    /**
     * Restart polling for the token list.
     */
    restart(): Promise<void>;
    private stopPolling;
    /**
     * Starts a new polling interval.
     *
     * @param interval - An interval on which to poll.
     */
    private startPolling;
    /**
     * Triggers asset ERC20 token auto detection for each contract address in contract metadata on mainnet.
     */
    detectTokens(): Promise<void>;
}
export default TokenDetectionController;
