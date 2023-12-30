import TelegramBot from 'node-telegram-bot-api';
import { OpenAI } from "openai";
import dotenv from 'dotenv';
import axios from 'axios';

//------------------------FUNCTIONS------------------------

async function getDish(chatId: number): Promise<void> {
    let spoonacularUrl: string = `https://api.spoonacular.com/recipes/complexSearch?query=${query}`;
    if (cuisine) {
        spoonacularUrl += `&cuisine=${cuisine}`;
    }
    if (diet) {
        spoonacularUrl += `&diet=${diet}`;
    }

    const response = await axios.get(spoonacularUrl + `&apiKey=${process.env.SPOONACULAR_TOKEN}`);

    const recipes: object[] = response.data.results;
    bot.sendMessage(chatId, 'Here is your recipe.');
    if(recipes.length < 0) {
        bot.sendMessage(chatId, `I can't find dishes with these parameters`);
    } else {
        recipes.forEach(recipe => sendRecipeWithImage(chatId, recipe));
    }
}

async function getParams(chatId: number, botMessage: string): Promise<string> {
    return new Promise<string>((resolve) => {
        bot.sendMessage(chatId, botMessage);

        bot.once('message', (msg) => {
            resolve(msg.text || '');
        });
    });
}

function sendRecipeWithImage(chatId: number, recipe: any): void {
    const caption = `${recipe.title}\n`;
    const photo = recipe.image;
    
    bot.sendPhoto(chatId, photo, { caption });
}

async function sendMessageWithKeyboard(chatId: number, text: string, buttons: [Button][]): Promise<void> {
    return new Promise<void>((resolve) => {
        bot.sendMessage(chatId, text, {
            reply_markup: {
                inline_keyboard: buttons
            }
        });
    });
}

interface Button {
    text: string
    callback_data: string
}

//------------------------CONFIG------------------------

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!
}); // chatGPT
const bot = new TelegramBot(process.env.TELEGRAMBOT_TOKEN!, { polling: true }); // Telegram Bot

let cuisine: string | null = null;
let diet: string | null = null;
let query: string | null = null;

//------------------------INTERACTIVITY------------------------

bot.onText(/\/start/, (msg) => {
    const chatId: number = msg.chat.id;
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

bot.on('callback_query', async msg => {
    const chatId: number = msg.message?.chat.id!;
    if(msg.data === `YesVeg`) {
        diet = 'vegetarian';
        getDish(chatId);
    }
    if(msg.data === `YesCuisine`) {
        cuisine = await getParams(msg.from.id, 'What is your favourite cuisine?');

        // Ask about being vegetarian
        await sendMessageWithKeyboard(chatId, 'Are you vegetarian?', [[{text: `Yes, i'm`, callback_data: 'YesVeg'}], [{text: `No, i'm not`, callback_data: 'NoVeg'}]]);
    }
});

bot.onText(/Write own request/, (msg) => { // chatGPT
    const chatId: number = msg.chat.id;
    bot.sendMessage(chatId, 'So write what you have in your refrigerator :)');

    bot.once('message', async reqMsg => {
        bot.sendMessage(chatId, `Wait, we're looking for something tasty ;D. Loading...`);
        const text: string = `Find me the best recipe that you can from this products: ${reqMsg.text} \n Write me result with detailed guide`;
        try {
            const response = await openai.chat.completions.create({
                messages: [{ role: 'system', content: text }],
                model: 'gpt-3.5-turbo',
            });
            bot.sendMessage(chatId, JSON.stringify(response.choices[0].message.content).replace(/\\n/g, '\n'));
        } catch(err: any) {
            console.error(err.message);
        }
    });
});

bot.onText(/Find recipe/, async (msg) => { // spoonacular
    const chatId: number = msg.chat.id;

    // Ask for the recipe query
    query = await getParams(chatId, 'So, now write me what you want to cook.');

     // Ask about cuisine preference
    await sendMessageWithKeyboard(chatId, 'Do you prefer some cuisine?', 
        [[{text: `Yes, I prefer cuisine`, callback_data: 'YesCuisine'}], [{text: `No, it's not necessary`, callback_data: 'NoCuisine'}]]);
});

bot.on('polling_error', console.log);