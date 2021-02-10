const { join } = require('path')
const { remote } = require('electron')
const { map } = require('bluebird')
const { readFileSync, readJsonSync, outputFileSync, outputJsonSync, existsSync } = require('fs-extra')
const { keys } = require('lodash')
const fetch = require('node-fetch')

const getCachePath = path => join(global.config.get('poi.misc.cache.path', remote.getGlobal('DEFAULT_CACHE_PATH')), 'KanColle', path)

const getCache = path =>
  existsSync(getCachePath(path))
    ? path.endsWith('.json')
      ? readJsonSync(getCachePath(path))
      : readFileSync(getCachePath(path)).toString()
    : undefined

const update = async (lastModified = {}, newLastModified = {}) => {
  const urls = keys(newLastModified).filter(url => !lastModified[url] || new Date(lastModified[url]) < new Date(newLastModified[url]))
  await map(urls, async url => {
    const path = url.replace('http://203.104.209.7/', '')
    const proxyUrl = `https://kcwiki.github.io/cache/${path}`
    const res = await fetch(proxyUrl)
    if (res.status === 200) {
      outputFileSync(getCachePath(path), await res.buffer())
      console.debug(`poi-plugin-let-me-in : updated : ${proxyUrl}, ${newLastModified[url]}`)
    } else {
      console.error(`poi-plugin-let-me-in : ${res.status}     : ${proxyUrl}`)
    }
  })
}

const check = async () => {
  const lastModifiedUrl = 'https://kcwiki.github.io/cache/last-modified.json'
  const res = await fetch(lastModifiedUrl, { headers: { 'if-modified-since': getCache('last-modified.json.ts') } })
  if (res.status === 200) {
    const newLastModified = await res.json()
    await update(getCache('last-modified.json'), newLastModified)
    outputFileSync(getCachePath('last-modified.json.ts'), res.headers.get('last-modified'))
    outputJsonSync(getCachePath('last-modified.json'), newLastModified, { spaces: 2 })
    console.debug(`poi-plugin-let-me-in : updated : ${lastModifiedUrl}, ${res.headers.get('last-modified')}`)
  } else if (res.status !== 304) {
    console.error(`poi-plugin-let-me-in : ${res.status}     : ${lastModifiedUrl}`)
  }
}

const main = async () => {
  console.debug(`poi-plugin-let-me-in : updating cache`)
  const start = +new Date()
  try {
    await check()
  } catch (e) {
    console.error(`poi-plugin-let-me-in : ${e.toString()}`)
  }
  const finish = +new Date()
  console.debug(`poi-plugin-let-me-in : done in ${finish - start} ms`)
  setTimeout(main, 10 * 60 * 1000)
}

main()
