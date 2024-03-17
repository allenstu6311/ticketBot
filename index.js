var request = require("request");
var cheerio = require("cheerio");
const puppeteer = require('puppeteer');
const { createWorker } = require('tesseract.js');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
var Jimp = require("jimp");
const { spawn } = require('child_process');
const tesseract = require("node-tesseract-ocr")
const fs = require('fs');
const secretInfo = require('./account')

async function login(page) {
    let currText = await handlePic(page)
    // 填寫表單
    await page.type('input#ACCOUNT', secretInfo.account);
    await page.type('input#PASSWORD', secretInfo.password);
    await page.type('input#CHK', currText);
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
        document.querySelector('a button.red').click();
    });
}

async function handlePic(page) {
    // const worker = await createWorker('eng');

    const captchaElement = await page.$('#chk_pic');
    // const captchaScreenshot = await captchaElement.screenshot();
    const captchaBoundingBox = await captchaElement.boundingBox();
    console.log('captchaBoundingBox', captchaBoundingBox)

    // 捕获屏幕截图
    const captchaScreenshot = await captchaElement.screenshot({
        clip: {
            x: captchaBoundingBox.x,
            y: captchaBoundingBox.y,
            width: Math.ceil(captchaBoundingBox.width),
            height: Math.ceil(captchaBoundingBox.height),
        }
    });

    const preprocessedImage = await sharp(captchaScreenshot)
        .resize({ width: captchaBoundingBox.width, height: captchaBoundingBox.height, fit: 'contain'})
        .gamma(2) // 調整亮度

        .modulate({//飽和
            // brightness:1.5,
            saturation:1.5,
        })

        // // .clahe({
        // //     width:80,
        // //     height:30,
        // //     maxSlope:100
        // // })

        .normalise()
        .normalize() // 正規化
        .grayscale()
        .sharpen()
        // .toBuffer();
        .toFile("preprocessed.jpg")


    // fs.writeFileSync('preprocessed.jpg', preprocessedImage);

    let currText = ''
    const result = await Tesseract.recognize("./preprocessed.jpg", 'eng', {
        oem: 0, // OCR Engine Mode，默认为 3，尝试不同的值
        psm: 1, // Page Segmentation Mode，默认为 3，尝试不同的值
    });




    currText = result.data.text;
    console.log('currText', currText)
    // const { data: { text } } = await worker.recognize(preprocessedImage);
    // 使用白名單字符集，只保留合法字符
    const whitelist = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let filteredText = '';
    filteredText = currText.split('').filter(char => whitelist.includes(char) && char !== ' ').join('');
    return filteredText
}


async function addCart(page) {
    let currText = await handlePic(page)
    console.log('currText', currText)
    await page.type("input#CHK", currText)
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
        document.querySelector('#addcart button.red').click();
    });
}

async function start() {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    const url = 'https://kham.com.tw/application/utk13/utk1306_.aspx'

    //   await page.goto('http://127.0.0.1:5500/index.html');
    await page.goto(url)
    await page.waitForTimeout(1000);
    await login(page)

    // await page.waitForNavigation();
    await page.waitForTimeout(1000);
    let currentURL = page.url();

    while (currentURL === url) {
        console.log('登录失敗！');
        await page.evaluate(() => {
            document.querySelector('.ui-dialog-buttonset  button.ui-button').click();
        });
        await page.evaluate(() => {
            document.querySelector('input#ACCOUNT').value = '';
            document.querySelector('input#PASSWORD').value = '';
            document.querySelector('input#CHK').value = '';
        });
        await page.waitForTimeout(1000);

        await login(page)
        await page.waitForTimeout(1000);
        currentURL = page.url();
    }

    console.log('登录成功！');

    await page.goto('https://kham.com.tw/application/UTK02/UTK0201_00.aspx?PRODUCT_ID=P0CGSYO7')
    //進入位置區
    await page.evaluate(() => {
        document.querySelector('a button.red').click();
    });
    await page.waitForNavigation()
    //選擇票價格
    await page.evaluate(() => {
        const table = document.querySelector("#AREA_DIV table")
        const rows = table.querySelectorAll("tr");
        rows.forEach((row, index) => {
            if (row.textContent.includes("3980")) {
                const tdToClick = row.querySelector("td");
                tdToClick.click();
            }
        });
    })
    // 選位置
    await page.waitForNavigation()
    await page.evaluate(() => {
        document.querySelector('.ticket button.green').click();
        const table = document.querySelector("#TBL")
        const rows = table.querySelectorAll("tr");
        let shouldBreak = false;
        rows.forEach((row, index) => {
            let tds = row.querySelectorAll("td")
            if (shouldBreak) return
            tds.forEach((td) => {
                let tdclass = td.getAttribute('class');
                if (shouldBreak) return
                if (tdclass && tdclass.includes("empty")) {
                    td.click()
                    shouldBreak = true
                    return
                }

            })
        });
    })

    const posUrl = 'https://kham.com.tw/application/UTK02/UTK0205_.aspx?PERFORMANCE_ID=P0CGXPYB&GROUP_ID=1&PERFORMANCE_PRICE_AREA_ID=P0CH2QSJ'
    currentURL = posUrl

    //加入購物車
    while (currentURL === posUrl) {
        console.log('加入購物車失敗！');
        await page.waitForSelector('input#CHK');
        await page.evaluate(() => {
            document.querySelector('input#CHK').value = '';
        })

        await addCart(page)
        await page.waitForTimeout(1000);

        // 等待元素出现
        await page.waitForSelector('.ui-dialog-buttonset  button.ui-button');
        await page.evaluate(() => {
            document.querySelector('.ui-dialog-buttonset  button.ui-button').click();
        });
        // await page.waitForTimeout(1000);

        currentURL = page.url();
    }
    console.log('加入購物車成功')
}
start()