'use strict';

const APPROVED_SKILL_BUNDLE_MANIFESTS = Object.freeze([
  Object.freeze({
    id: 'gstack',
    source: Object.freeze({ provider: 'github', repository: 'garrytan/gstack' }),
    pinnedRef: '94993f74012782fd94416dd44b8314f6363a13a4',
    pinnedCommit: '94993f74012782fd94416dd44b8314f6363a13a4',
    license: Object.freeze({ spdx: 'MIT', sourcePath: 'LICENSE' }),
    hostVariant: 'codex',
    rootDigest: null,
    installationState: 'registered',
  }),
  Object.freeze({
    id: 'mattpocock-skills',
    source: Object.freeze({ provider: 'github', repository: 'mattpocock/skills' }),
    pinnedRef: '84fdeffd12f2ee307994d1eb6feb48173b6e0502',
    pinnedCommit: '84fdeffd12f2ee307994d1eb6feb48173b6e0502',
    license: Object.freeze({ spdx: 'MIT', sourcePath: 'LICENSE' }),
    hostVariant: 'codex',
    rootDigest: null,
    installationState: 'registered',
  }),
]);

module.exports = {
  APPROVED_SKILL_BUNDLE_MANIFESTS,
};
