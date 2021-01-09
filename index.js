const { Telegraf } = require('telegraf')
const request = require('request')
const sharp = require('sharp')

const rembgHost = process.env.REMBG_HOST || 'rembg'
const rembgUrl = 'http://' + rembgHost + ':5000/?url='

async function processPhoto(ctx) {
    try {
        bot.telegram.sendChatAction(ctx.message.chat.id, 'typing')
        const photos = ctx.message.photo
        console.log(photos)
        const photo = photos[photos.length - 1]
        const fileId = photo.file_id
        const photoUrl = await bot.telegram.getFileLink(fileId)
        console.log(photoUrl)

        const processedUrl = rembgUrl + photoUrl
        const processedPhoto = request(processedUrl)
            .pipe(sharp().trim().resize({ width: 512, height: 512, fit: 'inside' } ).png())
        const stickerFile = await ctx.uploadStickerFile({ source: processedPhoto })
        console.log(stickerFile)
        const stickerSetName = 'r' + new Date().getTime() + '_by_rembgbot';
        await ctx.createNewStickerSet(stickerSetName, '@rembgbot', { png_sticker: stickerFile.file_id, emojis: '❤️' })
        await ctx.replyWithMarkdown('[Add Sticker](https://t.me/addstickers/' + stickerSetName + ')')
    } catch (error) {
        ctx.reply('' + error)
    }
}

const bot = new Telegraf(process.env.BOT_TOKEN)
bot.start(ctx => ctx.reply('Welcome! Send an picture to remove background'))
bot.on('photo', processPhoto)
bot.launch()