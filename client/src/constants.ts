// Feature flags for future modules
export const FEATURE_VOTING = typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env.VITE_FEATURE_VOTING !== 'undefined'
  ? import.meta.env.VITE_FEATURE_VOTING === 'true'
  : false;

export const FEATURE_WRAPPED = typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env.VITE_FEATURE_WRAPPED !== 'undefined'
  ? import.meta.env.VITE_FEATURE_WRAPPED === 'true'
  : false; 