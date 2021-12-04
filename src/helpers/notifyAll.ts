import {Context} from "telegraf";
import UserModel, {getUserDisplayName, UserSchema} from "../models/user";

export async function notifyAll(ctx: Context, newUser: UserSchema) {
    const users = await UserModel.find().select('id').where('id').ne(newUser.id);

    return Promise.all(users.map(({id}) => ctx.telegram.sendMessage(id, `Подружка ${getUserDisplayName(newUser)} присоединилась к игре 👏`)));
}
