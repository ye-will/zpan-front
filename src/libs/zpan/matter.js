/* eslint-disable no-console */
import { Semaphore } from 'await-semaphore'
import { Notification } from 'element-ui'
import utils from '../utils'
import axios, { rawAxios } from './axios'

function omitKeys(obj, keys) {
    const cmpKeys = keys.map(key => key.toLowerCase())
    return Object.fromEntries(Object.entries(obj).filter(([key]) => cmpKeys.indexOf(key.toLowerCase()) == -1))
}

function * splitFile(file, chunkSize) {
    const options = {type: file.type, lastModified: file.lastModified}
    let nowPosition = 0
    let chunkNumber = 1
    while (nowPosition < file.size) {
        const chunk = file.slice(nowPosition, nowPosition + chunkSize)
        yield [chunkNumber, new File([chunk], file.name, options)]
        nowPosition += chunkSize
        chunkNumber += 1
    }
}

function withRetry(left, fn) {
    return Promise.resolve(fn()).catch(e => {
        if (left == 0) return Promise.reject(e)
        return withRetry(left - 1, fn)
    })
}

function statusUpdater(chunkTotal, sizeTotal, updateFn) {
    const start = new Date().valueOf()
    let count = 0
    return function() {
        if (count < chunkTotal) {
            count += 1;
        }
        const percentage = count / chunkTotal
        const duration = new Date().valueOf() - start
        updateFn({
            progress: (percentage * 100).toFixed(2),
            speed: percentage * sizeTotal / duration * 1000
        })
    }
}

class zMatter {
    constructor () {
        this.sem = new Semaphore(10)
        this.retry = 3
        this.chunkSize = 10000000
    }

    createDir(sid, name, parent) {
        return axios.post("/matters", {
            sid,
            name,
            dir: parent,
            is_dir: true
        })
    }

    create(sid, dir, file, updateFile) {
        const matter = { sid: sid, name: file.name, type: file.type, size: file.size, dir: dir }
        return withRetry(this.retry, () => rawAxios.post('/api/matters', matter)).then(resp => {
            const data = resp.data.data
            if (data.multipart === true) return this.createMultipart(data, file, updateFile)
            return this.createSimple(data, file, updateFile)
        }).catch(err => {
            const msg = (err.response && err.response.data.msg) || err.message
            Notification.error(msg)
            Promise.reject(err)
        })
    }

    createSimple(data, file, updateFile) {
        const {uplink, headers} = data
        const alias = data.matter.alias
        const statusUpdate = statusUpdater(1, file.size, updateFile)
        return rawAxios.put(uplink, file.file, {headers: omitKeys(headers, ["content-length"])})
            .then(() => withRetry(this.retry, () => rawAxios.patch(`/api/matters/${alias}/done`)))
            .then(() => statusUpdate())
    }

    createMultipart(data, file, updateFile) {
        const alias = data.matter.alias
        const uploadId = data.upload_id
        const chunkTotal = Math.ceil(file.size / this.chunkSize)
        const statusUpdate = statusUpdater(chunkTotal, file.size, updateFile)
        const fileChunks = splitFile(file.file, this.chunkSize)
        const partRequest = []
        for (let i = 0; i < chunkTotal; i++) {
            partRequest.push(this.sem.use(() => {
                const {done, value} = fileChunks.next()
                if (done) return Promise.reject(new Error("out of file bound"))
                const [partNumber, partFile] = value
                return this.uploadPart(partFile, alias, uploadId, partNumber, partFile.size)
                    .then(data => {
                        statusUpdate()
                        return data
                    })
            }))
        }
        return Promise.all(partRequest).then(parts => this.uploadMultipartDone(alias, uploadId, parts))
    }

    uploadPart(file, alias, uploadId, partNumber, partSize) {
        // !!! important !!!
        // CORS rule Access-Control-Expose-Headers for ["etag"] should be set on bucket
        const body = {
            upload_id: uploadId,
            number: partNumber,
            size: partSize,
        }
        return withRetry(this.retry, () => rawAxios.patch(`/api/matters/${alias}/part`, body)
            .then(({data: {data: {uplink, headers}}}) => rawAxios.put(uplink, file, {headers: omitKeys(headers, ["content-length"])}))
            .then(({headers: {etag}}) => ({
                etag,
                number: partNumber
            }))
        )
    }

    uploadMultipartDone(alias, upload_id, parts) {
        const body = {
            upload_id,
            parts
        }
        return withRetry(this.retry, () => rawAxios.patch(`/api/matters/${alias}/done/multipart`, body))
    }

    get(alias) {
        return new Promise((resolve, reject) => {
            axios.get(`/matters/${alias}`).then(ret => {
                resolve(ret.data)
            }).catch(reject)
        })
    }

    download(alias) {
        return new Promise((resolve, reject) => {
            this.get(alias).then(ret => {
                utils.download(ret.name, ret.url).then(() => {
                    resolve(ret)
                }).catch(reject)
            })
        })
    }

    list(params) {
        return new Promise((resolve, reject) => {
            axios.get('/matters', { params: params }).then(ret => {
                let data = ret.data
                data.list = data.list.map(item => {
                    item.size = utils.formatBytes(item.size, 1);
                    item.fullpath = `${item.parent}${item.name}`
                    if (item.dirtype) item.fullpath += '/'
                    return item
                })
                resolve(data);
            }).catch(reject)
        })
    }

    rename(alias, name) {
        return axios.patch(`/matters/${alias}/name`, { name: name })
    }

    move(alias, newDir) {
        return axios.patch(`/matters/${alias}/location`, { dir: newDir })
    }

    copy(alias, newPath) {
        return axios.patch(`/matters/${alias}/duplicate`, { path: newPath })
    }

    delete(alias) {
        return axios.delete(`/matters/${alias}`)
    }

    save(alias, content) {
        return new Promise((resolve, reject) => {
            axios.get(`/matters/${alias}/ulink`).then(ret => {
                let data = ret.data
                rawAxios.put(data.link, content, { headers: data.headers }).then(() => {
                    axios.patch(`/matters/${alias}/done`).then((ret) => {
                        resolve(ret.data)
                    })
                }).catch(reject)
            }).catch(reject)
        })
    }
}

export default zMatter;
