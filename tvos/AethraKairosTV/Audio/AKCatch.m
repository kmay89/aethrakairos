//  AKCatch.m — see AKCatch.h.

#import "AKCatch.h"

NSException * _Nullable AKCatchException(NS_NOESCAPE void (^block)(void)) {
    @try {
        block();
        return nil;
    }
    @catch (NSException *exception) {
        return exception;
    }
}
