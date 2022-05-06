import { BaseController, BaseConfig, BaseState } from '../BaseController';
import type { NetworkState, NetworkType } from '../network/NetworkController';
import type { PreferencesState } from '../user/PreferencesController';
import { logOrRethrowError, timeoutFetch, toChecksumHexAddress } from '../util';
import { MAINNET } from '../constants';
import type {
  CollectiblesController,
  CollectiblesState,
  CollectibleMetadata,
} from './CollectiblesController';

const DEFAULT_INTERVAL = 180000;

/**
 * @type ApiCollectible
 *
 * Collectible object coming from OpenSea api
 * @property token_id - The collectible identifier
 * @property num_sales - Number of sales
 * @property background_color - The background color to be displayed with the item
 * @property image_url - URI of an image associated with this collectible
 * @property image_preview_url - URI of a smaller image associated with this collectible
 * @property image_thumbnail_url - URI of a thumbnail image associated with this collectible
 * @property image_original_url - URI of the original image associated with this collectible
 * @property animation_url - URI of a animation associated with this collectible
 * @property animation_original_url - URI of the original animation associated with this collectible
 * @property name - The collectible name
 * @property description - The collectible description
 * @property external_link - External link containing additional information
 * @property assetContract - The collectible contract information object
 * @property creator - The collectible owner information object
 * @property lastSale - When this item was last sold
 */
export interface ApiCollectible {
  token_id: string;
  num_sales: number | null;
  background_color: string | null;
  image_url: string | null;
  image_preview_url: string | null;
  image_thumbnail_url: string | null;
  image_original_url: string | null;
  animation_url: string | null;
  animation_original_url: string | null;
  name: string | null;
  description: string | null;
  external_link: string | null;
  asset_contract: ApiCollectibleContract;
  creator: ApiCollectibleCreator;
  last_sale: ApiCollectibleLastSale | null;
}

/**
 * @type ApiCollectibleContract
 *
 * Collectible contract object coming from OpenSea api
 * @property address - Address of the collectible contract
 * @property asset_contract_type - The collectible type, it could be `semi-fungible` or `non-fungible`
 * @property created_date - Creation date
 * @property collection - Object containing the contract name and URI of an image associated
 * @property schema_name - The schema followed by the contract, it could be `ERC721` or `ERC1155`
 * @property symbol - The collectible contract symbol
 * @property total_supply - Total supply of collectibles
 * @property description - The collectible contract description
 * @property external_link - External link containing additional information
 */
export interface ApiCollectibleContract {
  address: string;
  asset_contract_type: string | null;
  created_date: string | null;
  schema_name: string | null;
  symbol: string | null;
  total_supply: string | null;
  description: string | null;
  external_link: string | null;
  collection: {
    name: string | null;
    image_url?: string | null;
  };
}

/**
 * @type ApiCollectibleLastSale
 *
 * Collectible sale object coming from OpenSea api
 * @property event_timestamp - Object containing a `username`
 * @property total_price - URI of collectible image associated with this owner
 * @property transaction - Object containing transaction_hash and block_hash
 */
export interface ApiCollectibleLastSale {
  event_timestamp: string;
  total_price: string;
  transaction: { transaction_hash: string; block_hash: string };
}

/**
 * @type ApiCollectibleCreator
 *
 * Collectible creator object coming from OpenSea api
 * @property user - Object containing a `username`
 * @property profile_img_url - URI of collectible image associated with this owner
 * @property address - The owner address
 */
export interface ApiCollectibleCreator {
  user: { username: string };
  profile_img_url: string;
  address: string;
}

/**
 * @type CollectibleDetectionConfig
 *
 * CollectibleDetection configuration
 * @property interval - Polling interval used to fetch new token rates
 * @property networkType - Network type ID as per net_version
 * @property selectedAddress - Vault selected address
 * @property tokens - List of tokens associated with the active vault
 */
export interface CollectibleDetectionConfig extends BaseConfig {
  interval: number;
  networkType: NetworkType;
  chainId: `0x${string}` | `${number}` | number;
  selectedAddress: string;
}

/**
 * Controller that passively polls on a set interval for Collectibles auto detection
 */
export class CollectibleDetectionController extends BaseController<
  CollectibleDetectionConfig,
  BaseState
> {
  private intervalId?: NodeJS.Timeout;

  private getOwnerCollectiblesApi(address: string, offset: number) {
    return `https://proxy.metaswap.codefi.network/opensea/v1/api/v1/assets?owner=${address}&offset=${offset}&limit=50`;
  }

  private async getOwnerCollectibles(address: string) {
    let response: Response;
    let collectibles: any = [];
    const openSeaApiKey = this.getOpenSeaApiKey();
    let offset = 0;
    let pagingFinish = false;
    /* istanbul ignore if */
    do {
      const api = this.getOwnerCollectiblesApi(address, offset);
      try {
        response = await timeoutFetch(api, {}, 15000);
      } catch (e) {
        logOrRethrowError(e);
        if (openSeaApiKey) {
          response = await timeoutFetch(
            `https://api.opensea.io/api/v1/assets?owner=${address}&offset=${offset}&limit=50`,
            { headers: { 'X-API-KEY': openSeaApiKey } },
            15000,
          );
        } else {
          return [];
        }
      }
      const collectiblesArray = await response?.json();
      collectiblesArray.assets?.length !== 0
        ? (collectibles = [...collectibles, ...collectiblesArray.assets])
        : (pagingFinish = true);
      offset += 50;
    } while (!pagingFinish);
    return collectibles;
  }

  /**
   * Name of this controller used during composition
   */
  override name = 'CollectibleDetectionController';

  private getOpenSeaApiKey: () => string | undefined;

  private addCollectible: CollectiblesController['addCollectible'];

  private getCollectiblesState: () => CollectiblesState;

  /**
   * Creates a CollectibleDetectionController instance.
   *
   * @param options - The controller options.
   * @param options.onCollectiblesStateChange - Allows subscribing to assets controller state changes.
   * @param options.onPreferencesStateChange - Allows subscribing to preferences controller state changes.
   * @param options.onNetworkStateChange - Allows subscribing to network controller state changes.
   * @param options.getOpenSeaApiKey - Gets the OpenSea API key, if one is set.
   * @param options.addCollectible - Add a collectible.
   * @param options.getCollectiblesState - Gets the current state of the Assets controller.
   * @param config - Initial options used to configure this controller.
   * @param state - Initial state to set on this controller.
   */
  constructor(
    {
      onPreferencesStateChange,
      onNetworkStateChange,
      getOpenSeaApiKey,
      addCollectible,
      getCollectiblesState,
    }: {
      onCollectiblesStateChange: (
        listener: (collectiblesState: CollectiblesState) => void,
      ) => void;
      onPreferencesStateChange: (
        listener: (preferencesState: PreferencesState) => void,
      ) => void;
      onNetworkStateChange: (
        listener: (networkState: NetworkState) => void,
      ) => void;
      getOpenSeaApiKey: () => string | undefined;
      addCollectible: CollectiblesController['addCollectible'];
      getCollectiblesState: () => CollectiblesState;
    },
    config?: Partial<CollectibleDetectionConfig>,
    state?: Partial<BaseState>,
  ) {
    super(config, state);
    this.defaultConfig = {
      interval: DEFAULT_INTERVAL,
      networkType: MAINNET,
      chainId: '1',
      selectedAddress: '',
      disabled: true,
    };
    this.initialize();
    this.getCollectiblesState = getCollectiblesState;
    onPreferencesStateChange(({ selectedAddress, useCollectibleDetection }) => {
      const { selectedAddress: previouslySelectedAddress, disabled } =
        this.config;

      if (
        selectedAddress !== previouslySelectedAddress ||
        !useCollectibleDetection !== disabled
      ) {
        this.configure({ selectedAddress, disabled: !useCollectibleDetection });
      }

      if (useCollectibleDetection !== undefined) {
        if (useCollectibleDetection) {
          this.start();
        } else {
          this.stop();
        }
      }
    });

    onNetworkStateChange(({ provider }) => {
      this.configure({
        networkType: provider.type,
        chainId: provider.chainId as CollectibleDetectionConfig['chainId'],
      });
    });
    this.getOpenSeaApiKey = getOpenSeaApiKey;
    this.addCollectible = addCollectible;
  }

  /**
   * Start polling for the currency rate.
   */
  async start() {
    if (!this.isMainnet() || this.disabled) {
      return;
    }

    await this.startPolling();
  }

  /**
   * Stop polling for the currency rate.
   */
  stop() {
    this.stopPolling();
  }

  private stopPolling() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  /**
   * Starts a new polling interval.
   *
   * @param interval - An interval on which to poll.
   */
  private async startPolling(interval?: number): Promise<void> {
    interval && this.configure({ interval }, false, false);
    this.stopPolling();
    await this.detectCollectibles();
    this.intervalId = setInterval(async () => {
      await this.detectCollectibles();
    }, this.config.interval);
  }

  /**
   * Checks whether network is mainnet or not.
   *
   * @returns Whether current network is mainnet.
   */
  isMainnet = (): boolean => this.config.networkType === MAINNET;

  /**
   * Triggers asset ERC721 token auto detection on mainnet. Any newly detected collectibles are
   * added.
   */
  async detectCollectibles() {
    /* istanbul ignore if */
    if (!this.isMainnet() || this.disabled) {
      return;
    }
    const { selectedAddress, chainId } = this.config;

    /* istanbul ignore else */
    if (!selectedAddress) {
      return;
    }

    const apiCollectibles = await this.getOwnerCollectibles(selectedAddress);
    const addCollectiblesPromises = apiCollectibles.map(
      async (collectible: ApiCollectible) => {
        const {
          token_id,
          num_sales,
          background_color,
          image_url,
          image_preview_url,
          image_thumbnail_url,
          image_original_url,
          animation_url,
          animation_original_url,
          name,
          description,
          external_link,
          creator,
          asset_contract: { address, schema_name },
          last_sale,
        } = collectible;

        let ignored;
        /* istanbul ignore else */
        const { ignoredCollectibles } = this.getCollectiblesState();
        if (ignoredCollectibles.length) {
          ignored = ignoredCollectibles.find((c) => {
            /* istanbul ignore next */
            return (
              c.address === toChecksumHexAddress(address) &&
              c.tokenId === token_id
            );
          });
        }

        /* istanbul ignore else */
        if (!ignored) {
          /* istanbul ignore next */
          const collectibleMetadata: CollectibleMetadata = Object.assign(
            {},
            { name },
            creator && { creator },
            description && { description },
            image_url && { image: image_url },
            num_sales && { numberOfSales: num_sales },
            background_color && { backgroundColor: background_color },
            image_preview_url && { imagePreview: image_preview_url },
            image_thumbnail_url && { imageThumbnail: image_thumbnail_url },
            image_original_url && { imageOriginal: image_original_url },
            animation_url && { animation: animation_url },
            animation_original_url && {
              animationOriginal: animation_original_url,
            },
            schema_name && { standard: schema_name },
            external_link && { externalLink: external_link },
            last_sale && { lastSale: last_sale },
          );

          await this.addCollectible(address, token_id, collectibleMetadata, {
            userAddress: selectedAddress,
            chainId: chainId as string,
          });
        }
      },
    );
    await Promise.all(addCollectiblesPromises);
  }
}

export default CollectibleDetectionController;
