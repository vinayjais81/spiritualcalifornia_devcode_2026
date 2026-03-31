import { liteClient as algoliasearch } from 'algoliasearch/lite';

const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || '';
const searchKey = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY || '';

export const searchClient = algoliasearch(appId, searchKey);

export const GUIDES_INDEX = process.env.NEXT_PUBLIC_ALGOLIA_GUIDES_INDEX || 'guides';
export const PRODUCTS_INDEX = process.env.NEXT_PUBLIC_ALGOLIA_PRODUCTS_INDEX || 'products';
