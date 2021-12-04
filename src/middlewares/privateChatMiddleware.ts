import {Context} from "telegraf";

export function privateChatMiddleware(cxt: Context, next: () => Promise<void>) {
    if (cxt?.chat?.type === 'private') {
        return next();
    }
}
