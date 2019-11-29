declare const require: any;

type ctor<T> = new() => T;

export const Decoder: ctor<TextDecoder> = (typeof TextDecoder === 'undefined') ? require('util').TextDecoder : TextDecoder;
export const Encoder: ctor<TextEncoder> = (typeof TextEncoder=== 'undefined') ? require('util').TextEncoder : TextEncoder;
