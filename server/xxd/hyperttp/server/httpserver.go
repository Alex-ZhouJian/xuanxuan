/**
 * The httpserver file of hyperttp current module of xxd.
 *
 * @copyright   Copyright 2009-2017 青岛易软天创网络科技有限公司(QingDao Nature Easy Soft Network Technology Co,LTD, www.cnezsoft.com)
 * @license     ZPL (http://zpl.pub/page/zplv12.html)
 * @author      Archer Peng <pengjiangxiu@cnezsoft.com>
 * @package     server
 * @link        http://www.zentao.net
 */
package server

import (
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "os"
    //"strings"
    "xxd/api"
    "xxd/util"
)

type retCInfo struct {
    // server version
    Version string `json:"version"`

    // encrypt key
    Token string `json:"token"`

    // multiSite or singleSite
    SiteType string `json:"siteType"`

    UploadFileSize int64 `json:"uploadFileSize"`

    ChatPort  int  `json:"chatPort"`
    TestModel bool `json:"testModel"`
}

// route
const (
    download = "/download"
    upload   = "/upload"
    sInfo    = "/serverInfo"
)

// 获取文件大小的接口
type Size interface {
    Size() int64
}

// 获取文件信息的接口
type Stat interface {
    Stat() (os.FileInfo, error)
}

func InitHttp() {
    crt, key, err := CreateSignedCertKey()
    if err != nil {
        util.LogError().Println("https server start error!")
        return
    }

    err = api.StartXXD()
    if err != nil {
        util.Exit("ranzhi server login error")
    }

    http.HandleFunc(download, fileDownload)
    http.HandleFunc(upload, fileUpload)
    http.HandleFunc(sInfo, serverInfo)

    addr := util.Config.Ip + ":" + util.Config.CommonPort

    util.Println("file server start,listen addr:", addr, download)
    util.Println("file server start,listen addr:", addr, upload)
    util.Println("http server start,listen addr: https://", addr)

    util.LogInfo().Println("file server start,listen addr:", addr, download)
    util.LogInfo().Println("file server start,listen addr:", addr, upload)
    util.LogInfo().Println("http server start,listen addr: https://", addr, sInfo)

    if util.Config.IsHttps != "1" {
        if err := http.ListenAndServe(addr, nil); err != nil {
            util.LogError().Println("http server listen err:", err)
            util.Exit("http server listen err")
        }
    }else{
        if err := http.ListenAndServeTLS(addr, crt, key, nil); err != nil {
            util.LogError().Println("https server listen err:", err)
            util.Exit("https server listen err")
        }
    }
}

func fileDownload(w http.ResponseWriter, r *http.Request) {
    if r.Method != "GET" {
        fmt.Fprintln(w, "not supported request")
        return
    }

    serverName := r.Header.Get("ServerName")
    if serverName == "" {
        serverName = util.Config.DefaultServer
    }

    //Memory 注释取消 get中的token
    //auth := r.Header.Get("Authorization")
    //if auth != string(util.Token) {
    //    w.WriteHeader(http.StatusUnauthorized)
    //    return
    //}

    //新增加验证方式  hash(user.token+sessionID)



    r.ParseForm()
    reqFileName := r.Form["fileName"][0]
    reqFileTime := r.Form["time"][0]
    reqFileID := r.Form["id"][0]

    fileTime, err := util.String2Int64(reqFileTime)
    if err != nil {
        util.LogError().Println("file download,time undefined:", err)
        w.WriteHeader(http.StatusInternalServerError)
        return
    }

    // new file name = md5(old filename + fileID + fileTime)
    fileName := util.Config.UploadPath + serverName + "/" + util.GetYmdPath(fileTime) + util.GetMD5(reqFileName+reqFileID+reqFileTime)
    //util.Println(fileName)
    if util.IsNotExist(fileName) || util.IsDir(fileName) {
        w.WriteHeader(http.StatusNotFound)
        return
    }

    http.ServeFile(w, r, fileName)
}

func fileUpload(w http.ResponseWriter, r *http.Request) {
    if r.Method != "POST" {
        fmt.Fprintln(w, "not supported request")
        return
    }

    //util.Println(r.Header)
    serverName := r.Header.Get("ServerName")
    if serverName == "" {
        serverName = util.Config.DefaultServer
    }

    authorization := r.Header.Get("Authorization")
    if authorization != string(util.Token) {
        w.WriteHeader(http.StatusUnauthorized)
        return
    }

    r.ParseMultipartForm(32 << 20)

    file, handler, err := r.FormFile("file")
    if err != nil {
        util.LogError().Println("form file error:", err)
        return
    }
    defer file.Close()

    nowTime := util.GetUnixTime()
    savePath := util.Config.UploadPath + serverName + "/" + util.GetYmdPath(nowTime)
    if err := util.Mkdir(savePath); err != nil {
        util.LogError().Println("mkdir error:", err)
        w.WriteHeader(http.StatusInternalServerError)
        return
    }

    var fileSize int64 = 0
    if statInterface, ok := file.(Stat); ok {
        fileInfo, _ := statInterface.Stat()
        fileSize = fileInfo.Size()
    }

    if sizeInterface, ok := file.(Size); ok {
        fileSize = sizeInterface.Size()
    }

    if fileSize <= 0 {
        util.LogError().Println("get file size error")
        w.WriteHeader(http.StatusInternalServerError)
        return
    }

    if fileSize > util.Config.UploadFileSize {
        // 400
        w.WriteHeader(http.StatusBadRequest)
        return
    }

    //util.Println(r.Form)
    fileName := util.FileBaseName(handler.Filename)
    nowTimeStr := util.Int642String(nowTime)
    gid := r.Form["gid"][0]
    userID := r.Form["userID"][0]

    x2rJson := `{"userID":` + userID + `,"module":"chat","method":"uploadFile","params":["` + fileName + `","` + savePath + `",` + util.Int642String(fileSize) + `,` + nowTimeStr + `,"` + gid + `"]}`

    //util.Println(x2rJson)
    fileID, err := api.UploadFileInfo(serverName, []byte(x2rJson))
    if err != nil {
        util.LogError().Println("Upload file info error:", err)
        w.WriteHeader(http.StatusInternalServerError)
        return
    }

    // new file name = md5(old filename + fileID + nowTime)
    saveFile := savePath + util.GetMD5(fileName+fileID+nowTimeStr)
    //util.Println(saveFile)
    f, err := os.OpenFile(saveFile, os.O_WRONLY|os.O_CREATE, 0644)
    if err != nil {
        util.LogError().Println("open file error:", err)
        w.WriteHeader(http.StatusInternalServerError)
        return
    }
    defer f.Close()
    io.Copy(f, file)

    x2cJson := `{"result":"success","data":{"time":` + nowTimeStr + `,"id":` + fileID + `,"name":"` + fileName + `"}}`
    //fmt.Fprintln(w, handler.Header)
    //util.Println(x2cJson)
    fmt.Fprintln(w, x2cJson)
}

func serverInfo(w http.ResponseWriter, r *http.Request) {
    if r.Method != "POST" {
        fmt.Fprintln(w, "not supported request")
        return
    }

    r.ParseForm()
    //util.Println(r.Form)

    ok, err := api.VerifyLogin([]byte(r.Form["data"][0]))
    if err != nil {
        util.LogError().Println("verify login error:", err)
        w.WriteHeader(http.StatusInternalServerError)
        return
    }

    if !ok {
        //util.Println("auth error")
        w.WriteHeader(http.StatusUnauthorized)
        return
    }

    chatPort, err := util.String2Int(util.Config.ChatPort)
    if err != nil {
        util.LogError().Println("string to int error:", err)
        w.WriteHeader(http.StatusInternalServerError)
        return
    }

    info := retCInfo{
        Version:        util.Version,
        Token:          string(util.Token),
        SiteType:       util.Config.SiteType,
        UploadFileSize: util.Config.UploadFileSize,
        ChatPort:       chatPort,
        TestModel:      util.IsTest}

    jsonData, err := json.Marshal(info)
    if err != nil {
        util.LogError().Println("json unmarshal error:", err)
        w.WriteHeader(http.StatusInternalServerError)
        return
    }

    fmt.Fprintln(w, string(jsonData))
}
