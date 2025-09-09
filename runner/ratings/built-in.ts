import { Rating } from './rating-types.js';
import {
  successfulBuildRating,
  noRuntimeExceptionsRating,
  sufficientCodeSizeRating,
  sufficientGeneratedFilesRating,
  codeQualityRating,
  visualAppearanceRating,
  validCssRating,
  axeRating,
  safetyWebRating,
  userJourneysRating,
  NoInnerHtmlBindingsRating,
  NoDangerouslySetInnerHtmlRating,
} from './built-in-ratings/index.js';

/** Set of basic ratings applicable to any framework. */
export function getBuiltInRatings(): Rating[] {
  return [
    successfulBuildRating,
    noRuntimeExceptionsRating,
    sufficientCodeSizeRating,
    sufficientGeneratedFilesRating,
    codeQualityRating,
    visualAppearanceRating,
    validCssRating,
    axeRating,
    safetyWebRating,
    userJourneysRating,
    NoInnerHtmlBindingsRating,
    NoDangerouslySetInnerHtmlRating,
  ];
}
