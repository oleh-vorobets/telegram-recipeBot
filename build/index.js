import TelegramBot from 'node-telegram-bot-api';
import { OpenAI } from "openai";
import dotenv from 'dotenv';
import axios from 'axios';
async function getDish(chatId) {
    let spoonacularUrl = `https://api.spoonacular.com/recipes/complexSearch?query=${query}`;
    if (cuisine) {
        spoonacularUrl += `&cuisine=${cuisine}`;
    }
    if (diet) {
        spoonacularUrl += `&diet=${diet}`;
    }
    const response = await axios.get(spoonacularUrl + `&apiKey=${process.env.SPOONACULAR_TOKEN}`);
    const recipes = response.data.results;
    bot.sendMessage(chatId, 'Here is your recipe.');
    if (recipes.length < 0) {
        bot.sendMessage(chatId, `I can't find dishes with these parameters`);
    }
    else {
        recipes.forEach(recipe => sendRecipeWithImage(chatId, recipe));
    }
}
async function getParams(chatId, botMessage) {
    return new Promise((resolve) => {
        bot.sendMessage(chatId, botMessage);
        bot.once('message', (msg) => {
            resolve(msg.text || '');
        });
    });
}
function sendRecipeWithImage(chatId, recipe) {
    const caption = `${recipe.title}\n`;
    const photo = recipe.image;
    bot.sendPhoto(chatId, photo, { caption });
}
async function sendMessageWithKeyboard(chatId, text, buttons) {
    return new Promise((resolve) => {
        bot.sendMessage(chatId, text, {
            reply_markup: {
                inline_keyboard: buttons
            }
        });
    });
}
dotenv.config();
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});
const bot = new TelegramBot(process.env.TELEGRAMBOT_TOKEN, { polling: true });
let cuisine = null;
let diet = null;
let query = null;
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `Hello ${msg.from?.first_name}, I am Recipe bot, I can find a recipe from the products you have lying around in the fridge. Please choose option.`);
    const options = {
        reply_markup: {
            keyboard: [
                [{ text: 'Write own request' }, { text: 'Answer the questions' }]
            ],
            resize_keyboard: true,
            one_time_keyboard: false,
        },
    };
});
bot.on('callback_query', async (msg) => {
    const chatId = msg.message?.chat.id;
    if (msg.data === `YesVeg`) {
        diet = 'vegetarian';
        getDish(chatId);
    }
    if (msg.data === `YesCuisine`) {
        cuisine = await getParams(msg.from.id, 'What is your favourite cuisine?');
        await sendMessageWithKeyboard(chatId, 'Are you vegetarian?', [[{ text: `Yes, i'm`, callback_data: 'YesVeg' }], [{ text: `No, i'm not`, callback_data: 'NoVeg' }]]);
    }
});
bot.onText(/Write own request/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'So write what you have in your refrigerator :)');
    bot.once('message', async (reqMsg) => {
        bot.sendMessage(chatId, `Wait, we're looking for something tasty ;D. Loading...`);
        const text = `Find me the best recipe that you can from this products: ${reqMsg.text} \n Write me result with detailed guide`;
        try {
            const response = await openai.chat.completions.create({
                messages: [{ role: 'system', content: text }],
                model: 'gpt-3.5-turbo',
            });
            bot.sendMessage(chatId, JSON.stringify(response.choices[0].message.content).replace(/\\n/g, '\n'));
        }
        catch (err) {
            console.error(err.message);
        }
    });
});
bot.onText(/Find recipe/, async (msg) => {
    const chatId = msg.chat.id;
    query = await getParams(chatId, 'So, now write me what you want to cook.');
    await sendMessageWithKeyboard(chatId, 'Do you prefer some cuisine?', [[{ text: `Yes, I prefer cuisine`, callback_data: 'YesCuisine' }], [{ text: `No, it's not necessary`, callback_data: 'NoCuisine' }]]);
});
bot.on('polling_error', console.log);
//# sourceMappingURL=index.js.map