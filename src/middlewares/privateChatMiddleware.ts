import {Context} from "telegraf";

export function privateChatMiddleware(ctx: Context, next: () => Promise<void>) {
    if (ctx?.chat?.type === 'private') {
        return next();
    }
}
