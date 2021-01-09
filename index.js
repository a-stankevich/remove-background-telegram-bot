const { Telegraf } = require('telegraf')
const got = require('got')
const sharp = require('sharp')

const rembgHost = process.env.REMBG_HOST || 'rembg'
const rembgUrl = 'http://' + rembgHost + ':5000/?url='

const nr = require('newrelic') // application monitoring

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
        const photoBuffer = await got(processedUrl, { responseType: 'buffer', resolveBodyOnly: true });
        const processedPhoto = await sharp(photoBuffer)
            .trim()
            .resize({ width: 512, height: 512, fit: 'inside' })
            .png()
            .toBuffer();
        const stickerFile = await ctx.uploadStickerFile({ source: processedPhoto })
        console.log(stickerFile)
        const stickerSetName = 'r' + new Date().getTime() + '_by_rembgbot';
        await ctx.createNewStickerSet(stickerSetName, '@rembgbot', { png_sticker: stickerFile.file_id, emojis: '❤️' })
        await ctx.replyWithMarkdown('[Add Sticker](https://t.me/addstickers/' + stickerSetName + ')')
    } catch (error) {
        ctx.reply('' + error)
    }
}

async function newrelicMiddleware(ctx, next) {
    const wrapper = async () => {
        const transaction = nr.getTransaction()
        const message = ctx.update.message
        if (message) {
            nr.recordCustomEvent('message', { update_id: ctx.update.update_id, from_user: message.from.username, text: message.text })
        }
        try {
            await next(ctx)
        } catch (error) {
            console.error(error)
            nr.noticeError(error)
        }
        transaction.end()
    }
    console.log(ctx.updateType)
    await nr.startWebTransaction(ctx.updateType, wrapper)
}


const bot = new Telegraf(process.env.BOT_TOKEN)
bot.use(newrelicMiddleware)
bot.start(ctx => ctx.reply('Welcome! Send an picture to remove background'))
bot.on('photo', processPhoto)
bot.launch()