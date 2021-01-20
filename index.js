const { Telegraf } = require('telegraf')
const got = require('got')
const sharp = require('sharp')

if (!process.env.BOT_TOKEN) {
    console.error('BOT_TOKEN environment variable not found')
    return;
}

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
        let { data: processedPhoto, info: photoInfo } = await sharp(photoBuffer)
            .trim()
            .toBuffer({ resolveWithObject: true });
        if (photoInfo.width > 512 || photoInfo.height > 512) {
            processedPhoto = await sharp(processedPhoto)
                .resize({ width: 512, height: 512, fit: 'inside' })
                .toBuffer()
        } else if (photoInfo.width < 512 && photoInfo.height < 512) {
            const left_padding = Math.floor((512 - photoInfo.width) / 2)
            const right_padding = 512 - photoInfo.width - left_padding
            processedPhoto = await sharp(processedPhoto)
                .extend({
                    top: 0,
                    bottom: 0,
                    left: left_padding,
                    right: right_padding,
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .toBuffer()
        }

        processedPhoto = await sharp(processedPhoto)
            .png()
            .toBuffer()
        await ctx.replyWithPhoto({ source: processedPhoto })

        const stickerFile = await ctx.uploadStickerFile({ source: processedPhoto })
        console.log(stickerFile)
        const botName = ctx.botInfo.username
        const stickerSetName = 'r' + new Date().getTime() + '_by_' + botName;
        await ctx.createNewStickerSet(stickerSetName, '@rembgbot', { png_sticker: stickerFile.file_id, emojis: '❤️' })
        await ctx.replyWithMarkdown('[Add Sticker](https://t.me/addstickers/' + stickerSetName + ')')
    } catch (error) {
        ctx.reply('' + error)
        throw error;
    }
}

async function newrelicMiddleware(ctx, next) {
    const wrapper = async () => {
        const transaction = nr.getTransaction()
        const message = ctx.update.message
        if (message) {
            nr.addCustomAttributes({
                update_id: ctx.update.update_id,
                from_user: message.from.username,
                text: message.text
            })
        }
        try {
            await next(ctx)
        } catch (error) {
            console.error(error)
            nr.noticeError(error)
        }
        transaction.end()
    }
    await nr.startWebTransaction(ctx.updateType, wrapper)
}

const bot = new Telegraf(process.env.BOT_TOKEN)
bot.use(newrelicMiddleware)
bot.start(ctx => ctx.reply('Welcome! Send an picture to remove background'))
bot.on('photo', processPhoto)
bot.launch()