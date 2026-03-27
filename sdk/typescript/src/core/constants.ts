// NOTICE: This file is protected under RCF-PL v1.2.8
import { RCFMarker, RCFMarkerType } from './types';

// [RCF:PUBLIC]
export const RCF_MARKERS: Record<RCFMarkerType, RCFMarker> = {
  PUBLIC: {
    name: '[RCF:PUBLIC]',
    level: 0,
    description: 'Architecture and public concepts. Safe to discuss.',
    permissions: ['read', 'study', 'audit', 'discuss']
  },
  PROTECTED: {
    name: '[RCF:PROTECTED]',
    level: 1,
    description: 'Core methodology. Visible but not replicable.',
    permissions: ['read', 'study', 'audit'],
    restrictions: ['no-replication', 'no-automation', 'no-ml-training']
  },
  RESTRICTED: {
    name: '[RCF:RESTRICTED]',
    level: 2,
    description: 'Highly sensitive implementation. Minimal rights.',
    permissions: ['read'],
    restrictions: ['no-replication', 'no-automation', 'no-ml-training', 'no-modification']
  },
  NOTICE: {
    name: '[RCF:NOTICE]',
    level: 'meta',
    description: 'Triggers requirement for adjacent legal notice.',
    action: 'require-notice'
  }
};

export const MARKER_REGEX = /\[RCF:(PUBLIC|PROTECTED|RESTRICTED|NOTICE)\]/g;
