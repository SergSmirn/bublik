import mongoose, { Schema } from 'mongoose';

export interface UserSchema {
    id: number;
    username: string;
    name: string;
    surname: string;
    wishList?: string;
    recipientId: number | null;
    santaId: number | null;
}

const userSchema = new Schema<UserSchema>({
    id: {
        type: Number,
        unique: true,
    },
    username: {
        type: String,
    },
    name: {
        type: String,
        default: '',
    },
    surname: {
        type: String,
        default: '',
    },
    wishList: {
        type: String,
    },
    recipientId: {
        type: Number,
        default: null,
    },
    santaId: {
        type: Number,
        default: null,
    },
});

export function getUserDisplayName(user: UserSchema) {
    return [user.name, user.surname, `@${user.username}`].join(' ');
}

export default mongoose.model('User', userSchema);
