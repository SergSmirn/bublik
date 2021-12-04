import {Markup} from "telegraf";

export function yesNoKeyboard() {
    return Markup.inlineKeyboard([
        {text: 'Да', callback_data: 'yes'},
        {text: 'Нет', callback_data: 'no'},
    ], {columns: 2})
}
