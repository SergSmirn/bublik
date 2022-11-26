import {Telegraf, Context} from "telegraf";
import {connect} from "mongoose";
import UserModel, {getUserDisplayName, UserSchema} from "./models/user";
import {Chat} from "typegram";
import PrivateChat = Chat.PrivateChat;
import {notifyAll} from "./helpers/notifyAll";
import {getRandomInRange} from "./helpers/getRandomInRange";
import {privateChatMiddleware} from "./middlewares/privateChatMiddleware";
import {session} from "telegraf-session-mongodb";
import * as dotenv from "dotenv";
import {dateDiff} from "./helpers/dateDiff";

dotenv.config();

export interface SessionContext extends Context {
    session: {
        currentCommand?: Commands;
        lastStickerDate?: string;
    };
}

enum Commands {
    WishList,
    SendToRecipient,
    SendToSanta,
}

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/node-mongodb-server';
const BILLY_STICKERS_ID = ['CAACAgIAAxkBAAEGj0ZjgfzUEJGJ2pAwjFRAKs8SuJ_EegACNRIAAlbWCUhVwiQqqj_qfisE', 'CAACAgIAAxkBAAEGj5Jjgg4yWCy9gJOnq7f7_VpsE4UcFwACUhMAAkSLAAFIc7Llet9uhRwrBA', 'CAACAgIAAxkBAAEGj5Rjgg5Nuv7CAf_0FGT9CkfI1SvugAACaBkAAuy6AAFIUpaMcAAB5dCmKwQ', 'CAACAgIAAxkBAAEGj5Zjgg5hBaS602mbfdybR8qmwHhP-QACThQAAuh5IEgUTutarQ8FuSsE'];
const BILLY_INTERVAL = 10 * 60 * 1000;
const ADMIN_USERNAMES = ['SergSmirn'];

const bot = new Telegraf<SessionContext>(BOT_TOKEN);

connect(DATABASE_URL).then((client) => {
    const db = client.connection.db;
    bot.use(session(db, {sessionName: 'session', collectionName: 'sessions'}));

    bot.start(async (ctx: SessionContext) => {
        if (ctx?.chat?.type === 'private') {
            const chatInfo = ctx.chat;
            const alreadyExists = await UserModel.exists({id: chatInfo.id});

            if (!alreadyExists) {
                const newUser = await UserModel.create({
                    id: chatInfo.id,
                    name: chatInfo.first_name,
                    surname: chatInfo.last_name,
                    username: chatInfo.username
                });
                await notifyAll(ctx, newUser);
            }
        }
        ctx.session.currentCommand = undefined;

        await ctx.reply('Хай, брауни 🤙');
        await ctx.reply('Используй команду /getmembers, чтобы посмотреть всех участников игры');

        if (ctx?.chat?.type === 'private') {
            await ctx.reply('Используй команду /setwishlist, чтобы указать свои предпочтения');
            await ctx.reply('Используй команду /takerecipient, чтобы определить кому ты будешь дарить подарок. Но не спеши, подожди пока все подружки присоединятся к игре');
        }
    });

    bot.command('getmembers', async (ctx: SessionContext) => {
        const users = await UserModel.find();
        const text = 'Участники:\n' + users.map((user: UserSchema, index) => `${index + 1}. ${getUserDisplayName(user)}${user.wishList ? ' 📃' : ''}${user.recipientId ? ' 🎅' : ''}`).join('\n');
        ctx.reply(text);
    });

    bot.command('resetdata', privateChatMiddleware, async (ctx: SessionContext) => {
        const chat = ctx?.chat as PrivateChat;

        if (chat.username && ADMIN_USERNAMES.includes(chat.username)) {
            await UserModel.deleteMany();
            ctx.reply('БД очищена');
        }
    });

    bot.command('getdata', privateChatMiddleware, async (ctx: SessionContext) => {
        const chat = ctx?.chat as PrivateChat;

        if (chat.username && ADMIN_USERNAMES.includes(chat.username)) {
            const users = await UserModel.find();

            const text = 'Участники:\n' + users.map((user: UserSchema, index) => `${index + 1}. ${getUserDisplayName(user)} id: ${user.id}`).join('\n')
            ctx.reply(text);
        }
    });

    bot.command('setwishlist', privateChatMiddleware, async (ctx: SessionContext) => {
        ctx.session.currentCommand = Commands.WishList;
        ctx.reply('Напиши в следующем сообщении, что хочешь получить, а что нет');
    });

    bot.command('sendtorecipient', privateChatMiddleware, async (ctx: SessionContext) => {
        ctx.session.currentCommand = Commands.SendToRecipient;
        ctx.reply('Напиши в следующем сообщении, что хочешь передать своей подружке');
    });

    bot.command('sendtosanta', privateChatMiddleware, async (ctx: SessionContext) => {
        ctx.session.currentCommand = Commands.SendToSanta;
        ctx.reply('Напиши в следующем сообщении, что хочешь передать своему санте');
    });

    bot.command('takerecipient', privateChatMiddleware, async (ctx: SessionContext) => {
        const chatInfo = ctx.chat as PrivateChat;
        const contextUser = await UserModel.findOne({id: chatInfo.id});

        if (contextUser) {
            if (contextUser.recipientId) {
                return ctx.reply('У тебя уже есть пара');
            }

            const allRecipients: UserSchema[] = await UserModel.find({santaId: null}).where('id').ne(contextUser.id);
            const noSantaRecipients = allRecipients.filter(({recipientId}) => !recipientId);
            const recipient: UserSchema | undefined = noSantaRecipients.length === 1 ? noSantaRecipients[0] : allRecipients[getRandomInRange(allRecipients.length - 1)];

            if (!recipient) {
                return ctx.reply('Упс! Попробуй еще раз');
            }

            try {
                await UserModel.findOneAndUpdate({id: recipient.id, santaId: null}, {santaId: contextUser.id});
            } catch (_e) {
                return ctx.reply('Упс! Попробуй еще раз');
            }

            await contextUser.updateOne({recipientId: recipient.id});
            await ctx.reply(`Я подобрал для тебя пару, и это - ${getUserDisplayName(recipient)} 🎉🎉🎉`);
            const wishText = recipient.wishList ? '<b>Пожелания твоей подружки 💁‍♀️:\n</b>' + recipient.wishList : 'Твоя подружка не указала, что хочет';
            await ctx.replyWithHTML(wishText);
        }
    });

    bot.hears(/виолет/gi, (ctx: SessionContext) => {
        ctx.replyWithPhoto({source: 'images/kiril.jpg'});
    })

    bot.hears(/кот/gi, (ctx: SessionContext) => {
        ctx.replyWithPhoto(`https://thiscatdoesnotexist.com/?${new Date().getTime()}`);
    })

    bot.on('text', async (ctx: SessionContext) => {
        if (ctx?.chat?.type === 'private') {
            const chatInfo = ctx.chat as PrivateChat;
            const currentCommand = ctx.session.currentCommand;

            if (currentCommand === Commands.WishList) {
                // @ts-ignore
                const wishText: string | undefined = ctx.message.text;
                const currentUser = await UserModel.findOne({id: chatInfo.id});

                if (currentUser && wishText) {
                    await currentUser.updateOne({wishList: wishText});
                    await ctx.reply('Ну пинцет! Твои пожелания будут учтены, наверное...');

                    if (currentUser.santaId) {
                        await ctx.telegram.sendMessage(currentUser.santaId, 'Твой брауни изменил список пожеланий');
                        await ctx.telegram.sendMessage(currentUser.santaId, wishText);
                    }
                } else {
                    ctx.reply('Что-то пошло не так :(');
                }

                ctx.session.currentCommand = undefined;

                return;
            }

            if (currentCommand === Commands.SendToRecipient) {
                // @ts-ignore
                const messageText: string | undefined = ctx.message.text;
                const currentUser = await UserModel.findOne({id: chatInfo.id});

                if (currentUser && messageText) {
                    if (currentUser.recipientId) {
                        await ctx.telegram.sendMessage(currentUser.recipientId, 'Твой санта хочет тебе что-то сказать');
                        await ctx.telegram.sendMessage(currentUser.recipientId, messageText);
                    }

                    await ctx.reply('Передал твоё сообщение');
                } else {
                    ctx.reply('Что-то пошло не так :(');
                }

                ctx.session.currentCommand = undefined;

                return;
            }

            if (currentCommand === Commands.SendToSanta) {
                // @ts-ignore
                const messageText: string | undefined = ctx.message.text;
                const currentUser = await UserModel.findOne({id: chatInfo.id});

                if (currentUser && messageText) {
                    if (currentUser.santaId) {
                        await ctx.telegram.sendMessage(currentUser.santaId, 'Твой брауни хочет тебе что-то сказать');
                        await ctx.telegram.sendMessage(currentUser.santaId, messageText);
                    }

                    await ctx.reply('Передал твоё сообщение');
                } else {
                    ctx.reply('Что-то пошло не так :(');
                }

                ctx.session.currentCommand = undefined;

                return;
            }

            ctx.replyWithPhoto(`https://thiscatdoesnotexist.com/?${new Date().getTime()}`)
        }

        const lastStickerDate = ctx.session.lastStickerDate && new Date(ctx.session.lastStickerDate);
        const nowDate = new Date();

        if (ctx.message?.from.last_name === 'Снизов' && (!lastStickerDate || dateDiff(nowDate, lastStickerDate) > BILLY_INTERVAL)) {
            ctx.session.lastStickerDate = nowDate.toISOString();
            return ctx.replyWithSticker(BILLY_STICKERS_ID[getRandomInRange(BILLY_STICKERS_ID.length - 1)], {reply_to_message_id: ctx.message?.message_id});
        }
    })

    bot.launch();
});

