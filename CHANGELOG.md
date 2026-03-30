# Changelog

## [3.1.4](https://github.com/jrschumacher/go-actions/compare/go-actions-v3.1.3...go-actions-v3.1.4) (2026-03-30)


### Bug Fixes

* configure GoReleaser to handle release-please tag prefix ([b935699](https://github.com/jrschumacher/go-actions/commit/b935699b200f66d731dea82ba99bd5e1db1d6240))
* parse golangci-lint version from plain text output ([f88be92](https://github.com/jrschumacher/go-actions/commit/f88be92c2aff03636a79d6db92b392f2e8108e93))

## [3.1.3](https://github.com/jrschumacher/go-actions/compare/go-actions-v3.1.2...go-actions-v3.1.3) (2026-03-30)


### Bug Fixes

* auto-select compatible golangci-lint version for any Go release ([6b5d056](https://github.com/jrschumacher/go-actions/commit/6b5d056474d38f2341f80c67d399c774a9df360b)), closes [#37](https://github.com/jrschumacher/go-actions/issues/37)

## [3.1.2](https://github.com/jrschumacher/go-actions/compare/go-actions-v3.1.1...go-actions-v3.1.2) (2026-03-28)


### Bug Fixes

* move main.go to cmd/go-actions/ so go install produces correct binary name ([dcc77fc](https://github.com/jrschumacher/go-actions/commit/dcc77fcad47df83b6430ea221ed402014fccadc2)), closes [#67](https://github.com/jrschumacher/go-actions/issues/67)

## [3.1.1](https://github.com/jrschumacher/go-actions/compare/go-actions-v3.1.0...go-actions-v3.1.1) (2026-03-12)


### Bug Fixes

* separate stderr from JSON output to prevent corruption ([#64](https://github.com/jrschumacher/go-actions/issues/64)) ([2e5488d](https://github.com/jrschumacher/go-actions/commit/2e5488de251812a2daec3da0190a412565ab7fea))
* update PATH in current shell before running golangci-lint ([#66](https://github.com/jrschumacher/go-actions/issues/66)) ([342c5b5](https://github.com/jrschumacher/go-actions/commit/342c5b55f90a60363ea033be10949f9cacc49885))

## [3.1.0](https://github.com/jrschumacher/go-actions/compare/go-actions-v3.0.1...go-actions-v3.1.0) (2026-03-07)


### Features

* enforce caller-provided checkout across all actions ([#44](https://github.com/jrschumacher/go-actions/issues/44)) ([9bba67a](https://github.com/jrschumacher/go-actions/commit/9bba67ae92ef72e90e7a8d7f892027d7de8536ca))
* integrate .go-actions.yaml config into CI and release actions ([#46](https://github.com/jrschumacher/go-actions/issues/46)) ([2b6d6b0](https://github.com/jrschumacher/go-actions/commit/2b6d6b0cf5fd0b6a7a194e97d97b186e0d856412))
* merge-aware PR commenting with race handling ([#49](https://github.com/jrschumacher/go-actions/issues/49)) ([c9c41ae](https://github.com/jrschumacher/go-actions/commit/c9c41aef258ef752a24ab87b57d6e6a7d2466c69))
* **release:** pass through release-please config-file and manifest-file inputs ([#40](https://github.com/jrschumacher/go-actions/issues/40)) ([40ae089](https://github.com/jrschumacher/go-actions/commit/40ae089116760b5433070989bde494647e832069)), closes [#39](https://github.com/jrschumacher/go-actions/issues/39)
* surface test/lint/security output in CI action for better failure diagnostics ([#50](https://github.com/jrschumacher/go-actions/issues/50)) ([fbf376e](https://github.com/jrschumacher/go-actions/commit/fbf376ecbb8ec9a3f3ac893d25017f1ec0f74d69))


### Bug Fixes

* remove duplicate release-please config at top level ([#58](https://github.com/jrschumacher/go-actions/issues/58)) ([89ccb98](https://github.com/jrschumacher/go-actions/commit/89ccb98dffd480b45c676726d49715ce8b4a9023))
* restore component name in release-please config ([#54](https://github.com/jrschumacher/go-actions/issues/54)) ([b34fec6](https://github.com/jrschumacher/go-actions/commit/b34fec64f75df9f629d5bcb637839fa6ff87e8db))
* update release-please config for Go CLI ([#51](https://github.com/jrschumacher/go-actions/issues/51)) ([9c562cb](https://github.com/jrschumacher/go-actions/commit/9c562cbd9063ad2a7e14ad778c3f519f08d24eaf))
* use correct action inputs and quote shell variables ([#60](https://github.com/jrschumacher/go-actions/issues/60)) ([4495a84](https://github.com/jrschumacher/go-actions/commit/4495a840c89c8affa0c5ab051adb00999849787f))
* validate release-please config setup ([#62](https://github.com/jrschumacher/go-actions/issues/62)) ([302632e](https://github.com/jrschumacher/go-actions/commit/302632ec5d06d3ff2ff531882448031e5992e183))


### Documentation

* add Wails v2 and v3 setup recommendations for go-actions ([#43](https://github.com/jrschumacher/go-actions/issues/43)) ([d787fa9](https://github.com/jrschumacher/go-actions/commit/d787fa9d087b4627c02cf8956187b07b7d53e33a))
* address issues [#36](https://github.com/jrschumacher/go-actions/issues/36) and [#38](https://github.com/jrschumacher/go-actions/issues/38) — improve README and setup guidance ([#42](https://github.com/jrschumacher/go-actions/issues/42)) ([ad6e463](https://github.com/jrschumacher/go-actions/commit/ad6e463b1c15edbd2d50fe21cddaf31ef5d7233a))

## [3.0.1](https://github.com/jrschumacher/go-actions/compare/go-actions-v3.0.0...go-actions-v3.0.1) (2026-02-03)


### ⚠ BREAKING CHANGES

* The separate `comment` action has been removed. PR comments are now posted directly by the CI action using `github-comment: true` input.

### Bug Fixes

* checkout release tag in goreleaser job ([#34](https://github.com/jrschumacher/go-actions/issues/34)) ([d3da738](https://github.com/jrschumacher/go-actions/commit/d3da738d14e566e2f88b01320166b8dea779836e))
* Port PR comments to Go CLI, remove TypeScript ([#31](https://github.com/jrschumacher/go-actions/issues/31)) ([3c02cef](https://github.com/jrschumacher/go-actions/commit/3c02cef8682201f4368ad23e979339dffbae6a01))
* remove obsolete TypeScript validation from release workflow ([#32](https://github.com/jrschumacher/go-actions/issues/32)) ([2d371bb](https://github.com/jrschumacher/go-actions/commit/2d371bb488f1c01bf39d320a7691dd527f5dca66))


### Documentation

* update README to use [@v3](https://github.com/v3) tag ([86eb108](https://github.com/jrschumacher/go-actions/commit/86eb10888066277ac813e09b496bfe786422e93d))

## [3.0.0](https://github.com/jrschumacher/go-actions/compare/go-actions-v2.0.0...go-actions-v3.0.0) (2026-02-01)


### ⚠ BREAKING CHANGES

* Actions now require Go to build CLI during execution. TypeScript formatters retained for PR comment generation.

### Features

* port actions to Go CLI for local/CI parity (v3.0.0-beta.1) ([#26](https://github.com/jrschumacher/go-actions/issues/26)) ([660cb55](https://github.com/jrschumacher/go-actions/commit/660cb550c17022855efc3a79775244aba8ce71e6))

## [2.0.0](https://github.com/jrschumacher/go-actions/compare/go-actions-v1.2.0...go-actions-v2.0.0) (2026-01-29)


### ⚠ BREAKING CHANGES

* Updated Release Please configuration format

### Features

* add comprehensive Release Please filename validation ([da3c32e](https://github.com/jrschumacher/go-actions/commit/da3c32eeeb6cbd04ce7cc4556c77107b44f0373f))
* add golangci-lint validator ([78a0eb0](https://github.com/jrschumacher/go-actions/commit/78a0eb06ac62036a74ea3c4dce1247fe73bf0bd4))
* add processing state indicator to PR comments ([#6](https://github.com/jrschumacher/go-actions/issues/6)) ([709a3d3](https://github.com/jrschumacher/go-actions/commit/709a3d33567a3ddda98db90ecd0f9561f90bb93f))
* add security job type with govulncheck CVE scanning ([#16](https://github.com/jrschumacher/go-actions/issues/16)) ([7112841](https://github.com/jrschumacher/go-actions/commit/7112841d56cdd0689410ae0fe2ba2fa424a04f87))
* auto-compile TypeScript for dependabot PRs ([#18](https://github.com/jrschumacher/go-actions/issues/18)) ([615f0bb](https://github.com/jrschumacher/go-actions/commit/615f0bbed045b607c654077f7b0310424a9ccfc4))
* comprehensive validator enhancements with structured PR comments ([6120608](https://github.com/jrschumacher/go-actions/commit/612060843920b0f30aa83bc15e21aeffe42c3849))
* consolidate action logic and fix cross-job commenting ([f6875b9](https://github.com/jrschumacher/go-actions/commit/f6875b9a65059a090f91a7f4b00b5ce72934d450))
* enhance golangci-lint validation and defaults-first documentation ([#11](https://github.com/jrschumacher/go-actions/issues/11)) ([ade6c0d](https://github.com/jrschumacher/go-actions/commit/ade6c0de31f35c42a05b2fd7eb13c0e892177d2d))
* enhance PR comments with actionable fix suggestions ([1129fd7](https://github.com/jrschumacher/go-actions/commit/1129fd77d044dfedb8ccbe8062937b5f47d20084))
* enhance self-validator to detect golangci-lint version incompatibilities ([4597e57](https://github.com/jrschumacher/go-actions/commit/4597e5762cc55eb651da0db347029eebf17e36a6))
* expose lint issues directly in PR comments ([e2a95da](https://github.com/jrschumacher/go-actions/commit/e2a95daa3a29efecd80d14d3bc0e76be00c64f34))
* first commit ([9b21efd](https://github.com/jrschumacher/go-actions/commit/9b21efda6016673febe9b0fa2a55b1171c54ce24))
* implement clean unified workflow architecture ([68ac005](https://github.com/jrschumacher/go-actions/commit/68ac005468cf60834efddeb1c94a25f5efb1030a))
* implement unified Go Actions Report comment system ([dff14cf](https://github.com/jrschumacher/go-actions/commit/dff14cfa54e2c80b1072b4f69be440e929f9c9be))
* improve Release Please configuration validation for v16+ ([4354632](https://github.com/jrschumacher/go-actions/commit/4354632e61283876e58b6af7fbef1af1735de74f))
* include golangci-lint issues in PR comments ([#10](https://github.com/jrschumacher/go-actions/issues/10)) ([#12](https://github.com/jrschumacher/go-actions/issues/12)) ([219507a](https://github.com/jrschumacher/go-actions/commit/219507a65663f2811492557733c574c61a7b1dba))
* integrate all CI jobs with unified Go Actions Report ([4265004](https://github.com/jrschumacher/go-actions/commit/426500446f389e56c6f75d93cd7aae86ff86fec1))


### Bug Fixes

* add golangci-lint v2 CI/CD configuration guidance and fix schema compliance ([#13](https://github.com/jrschumacher/go-actions/issues/13)) ([be33fb2](https://github.com/jrschumacher/go-actions/commit/be33fb248866a7d866fb285daf04bc1f285fbb90))
* add missing release-type parameter to Release Please action ([7dd9639](https://github.com/jrschumacher/go-actions/commit/7dd963947cc17a50b96542badeb6a8a75888a2fb))
* bundle dependencies with proper exports ([569e358](https://github.com/jrschumacher/go-actions/commit/569e35813cd89ca5153cf83024c7a5f3c40735fc))
* correct Go module tagging in release action ([c24a699](https://github.com/jrschumacher/go-actions/commit/c24a699a05534bcb8a0da050b05f6e2ce962354e))
* handle missing ACTIONS_RUNTIME_TOKEN in artifact operations ([01a3dd4](https://github.com/jrschumacher/go-actions/commit/01a3dd41b6762b5acba47bd9503348229595e1ea))
* implement proper unified comment system with dedicated post-job action ([f680463](https://github.com/jrschumacher/go-actions/commit/f68046378dee0816997e52b4f87716b8bb3218da))
* improve security, type safety, and code quality ([#5](https://github.com/jrschumacher/go-actions/issues/5)) ([b1a2202](https://github.com/jrschumacher/go-actions/commit/b1a22023058477e3361ce8e0ac650def91f88c71))
* move github.context check inside try-catch block ([e5888d6](https://github.com/jrschumacher/go-actions/commit/e5888d6f00015d470444bc2797d6a10942db6f48))
* raise audit level to high to allow moderate ReDoS vulnerabilities in dependencies ([c38de1a](https://github.com/jrschumacher/go-actions/commit/c38de1ae70e74ed276526af5199835369201e08c))
* rebuild all bundles with correct sizes to prevent nesting issue ([4298faf](https://github.com/jrschumacher/go-actions/commit/4298faff7a95b3092b998f4940b09c1c9433ba3c))
* remove brittle needs dependency from comment job ([16fc00b](https://github.com/jrschumacher/go-actions/commit/16fc00b2ca4ea042ff73ab3e2faabdd4d2a60da4))
* remove redundant validation from release action ([1786dd9](https://github.com/jrschumacher/go-actions/commit/1786dd936041d548e59e957bea8cf4bfd12171cc))
* resolve ncc build nesting issue by cleaning scripts-dist ([a9f64dd](https://github.com/jrschumacher/go-actions/commit/a9f64ddada6fb01a37d5240280f8d45da0748914))
* simplify golangci-lint upgrade guidance to align with go-actions philosophy ([008519f](https://github.com/jrschumacher/go-actions/commit/008519f7f02aa43b61058382f4fcf16924f3d850))
* update all tests to match new release-please filename convention ([d83e2e5](https://github.com/jrschumacher/go-actions/commit/d83e2e5db4021301c5c70e050b44f9ea120a522e))
* update comment detection string to match new PR comment header ([3280672](https://github.com/jrschumacher/go-actions/commit/32806729412b07f5cc2b3b8f671e513c275a34d9))
* update compiled self-validate bundle to match source ([6bfed4e](https://github.com/jrschumacher/go-actions/commit/6bfed4e6748e1b4a76eb39a8a9cfffc1263b6d14))
* update Release Please action to v4.2.0 and remove redundant parameters ([fe62a18](https://github.com/jrschumacher/go-actions/commit/fe62a1832cd7c9b404127b1eb144d80172023f80))
* update Release Please config to v16+ format ([c88410d](https://github.com/jrschumacher/go-actions/commit/c88410d2ebe9c42ed5d4abd0c203bb38bf0714b6))
* update unified PR comment tests to match new format ([d737ebb](https://github.com/jrschumacher/go-actions/commit/d737ebbb299096c6e78c253e009f17c98b97ab2c))
* use correct context import for PR commenting ([cd4fff0](https://github.com/jrschumacher/go-actions/commit/cd4fff0afd9d1bcf05ef89c14bfe159bb3de5eb9))
* use environment variables instead of @actions/github for PR commenting ([19e00a1](https://github.com/jrschumacher/go-actions/commit/19e00a1330bcbe57ef4af8b95a7c3c308695665b))
* validate correct Release Please config filename ([963161c](https://github.com/jrschumacher/go-actions/commit/963161cb6ed15aad50a56fdcde59c49c2958b5f3))
* wrap PR commenting in try-catch to prevent action failure ([6aefbc2](https://github.com/jrschumacher/go-actions/commit/6aefbc2808f5940bf3c39a18706d25aafd2200cd))


### Documentation

* add release and tagging workflow to memory ([076d5e9](https://github.com/jrschumacher/go-actions/commit/076d5e9c034230f77ea35eea723bbd994cb20618))
* add required permissions for PR commenting ([0858893](https://github.com/jrschumacher/go-actions/commit/0858893cdb791e1e5f34e44487a9b1fda32e1b02))
* restructure README for agent-friendly consumption ([#4](https://github.com/jrschumacher/go-actions/issues/4)) ([f36b223](https://github.com/jrschumacher/go-actions/commit/f36b223efbc40e069d58ca9502dea66f3c63e123))
