const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const schedule = require('node-schedule');

const {
    sessionId,
    domain,
    username,
    postGridClasses,
    postClasses,
    ffClasses,
    postNumberClasses,
    bioSpanClasses,
} = require('./config');
const url = domain + username;

const getInformation = async () => {
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();

    await page.setCookie({
        name: 'sessionid',
        value: sessionId,
        domain: '.instagram.com',
    });

    await page.goto(url, {waitUntil: 'networkidle2'});

    const information = await page.evaluate((ffClasses, postNumberClasses, bioSpanClasses) => {
        try {
            const followersElement = document.getElementsByClassName(ffClasses)[0] || null;
            const followingElement = document.getElementsByClassName(ffClasses)[1] || null;
            const postsNumberElement = document.getElementsByClassName(postNumberClasses)[0] || null;
            const bioElement = document.getElementsByClassName(bioSpanClasses)[1] || null;

            if (!followersElement || !followingElement || !postsNumberElement || !bioElement) {
                new Error('Some elements not found.');
            }

            const followers = followersElement ? Number(followersElement.innerText.split(' ')[0].replace(/,/g, '')) : null;
            const following = followingElement ? Number(followingElement.innerText.split(' ')[0].replace(/,/g, '')) : null;
            const posts = postsNumberElement ? Number(postsNumberElement.innerText.replace(/,/g, '')) : null;
            const bio = bioElement ? bioElement.innerText : null;

            const date = new Date().toLocaleString('en-US', {
                timeZone: 'Europe/Istanbul',
                hour12: true,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
            });

            return {
                followers: isNaN(followers) ? null : followers,
                following: isNaN(following) ? null : following,
                posts: isNaN(posts) ? null : posts,
                bio: bio || null,
                date,
            };
        } catch (error) {
            console.error('Error extracting information: ', error);

            return null;
        }
    }, ffClasses, postNumberClasses, bioSpanClasses);

    if (!information) {
        console.error('Failed to retrieve information.');

        await browser.close();
        return;
    }

    const jsonFilePath = path.resolve(__dirname, 'log.json');
    let json = {};

    if (fs.existsSync(jsonFilePath)) {
        const fileContent = fs.readFileSync(jsonFilePath, 'utf8');

        json = JSON.parse(fileContent)
    }

    if (!json[username]) {
        json[username] = [];
    }

    const logs = json[username];
    const latestInformation = logs[logs.length - 1] || {};

    const hasChanged = latestInformation.followers !== information.followers ||
        latestInformation.following !== information.following ||
        latestInformation.posts !== information.posts ||
        latestInformation.bio !== information.bio;

    if (hasChanged || logs.length === 0) {
        logs.push(information);
        json[username] = logs;

        fs.writeFileSync(jsonFilePath, JSON.stringify(json, null, 3), 'utf8');
    }

    await browser.close();

    return information;
}

schedule.scheduleJob('*/15 * * * *', async () => {
    try {
        const information = await getInformation();

        console.log('Information retrieved: ', information);
    } catch (e) {
        console.error('Error occurred: ', e);
    }
});
