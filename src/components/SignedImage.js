/**
 * SignedImage — drop-in replacement for SmartImage when the source may be a
 * private chat_media attachment. Resolves the stored URL to a short-lived
 * signed URL before rendering; any other URL passes straight through.
 */
import React, { useEffect, useState } from 'react';
import { SmartImage } from './SmartImage';
import { signedChatMediaUrl, chatMediaPath } from '../utils/signedMedia';

export const SignedImage = ({ source, ...rest }) => {
  // Non-chat URLs need no signing — render immediately, no flicker.
  const needsSigning = !!chatMediaPath(source);
  const [uri, setUri] = useState(needsSigning ? null : source);

  useEffect(() => {
    let alive = true;
    if (!needsSigning) { setUri(source); return; }
    signedChatMediaUrl(source).then(u => { if (alive) setUri(u); });
    return () => { alive = false; };
  }, [source, needsSigning]);

  if (!uri) return null; // brief resolve; falls back to the stored URL on failure
  return <SmartImage source={uri} {...rest} />;
};
