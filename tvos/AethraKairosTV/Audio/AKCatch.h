//  AKCatch.h — the one Objective-C file in the app, and its bridging header.
//
//  AVFAudio reports a broken precondition (a player started on a stopped
//  engine, a tap on a format that just went away, a graph that will not
//  initialize) by RAISING an NSException, and Swift cannot catch one: the
//  process aborts. This shim runs a block inside @try and hands back the
//  exception instead, so DeckEngine can turn the abort into a failed call
//  that the Player's liveness guard simply retries a moment later.
//
//  Keep the blocks passed here to the single AVFAudio call being guarded:
//  an exception unwinds through the Swift closure frame without running its
//  cleanups, so nothing worth releasing should live in it.

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// Runs `block`. Returns nil when it returned normally, or the NSException
/// it raised.
FOUNDATION_EXPORT NSException * _Nullable AKCatchException(NS_NOESCAPE void (^block)(void));

NS_ASSUME_NONNULL_END
