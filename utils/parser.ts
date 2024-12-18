import fs from "fs";
import path from "path";
import { globSync } from "glob";
import { systemInfoRegex, userPassRegex } from "./regex";
import crypto from 'crypto'
import gov from '../gov.json'
import edu from '../edu.json'
import mongodb from "../utils/mongodb";
interface ParsedJSONData {
  folder: string
  system: Record<string, any>[]
  password: Record<string, any>[]
}
type IFinalData = IndentityData & IPassData & ISysInfo
type IndentityData = {
  id: string
  storage: string
  date_time_added: Date
}
type IPassData = {
  login: string
  password: string
  url: string
  storage: string
  flag_employee: string
  flag_thirdparty: string
  flag_user: string
  flag_gov: string
  flag_edu: string
}
type ISysInfo = {
  date_time_compromised: Date | null
  malware_name: string
  machine_id: string
  path: string
  ip: string
  location: string
  operation_sistem: string 
  computer_name: string
  antivirus: string[]
}
class Parser {
  private static instance: Parser 
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}
  public static getInstance() {
    if(!Parser.instance) {
      this.instance = new Parser()
    }
    return this.instance
  }

  public async formatDataWithRegex(parsedData: ParsedJSONData[], filename: string, file_id: string) {
    let finalData: IFinalData[] = []
    parsedData.map(data => {
      if(data.password.length){
        const systemInfo: ISysInfo = {
          antivirus: [],
          computer_name: "-",
          ip: "-",
          location: "-",
          machine_id: "-",
          operation_sistem: "-",
          path: "-",
          date_time_compromised: null,
          malware_name: "unknown",
          
        }
        if(data.system.length !== 0){
          const sys = data.system[0]
          for(const syskey in sys){
            if(data.folder){
              let matchLoc = data.folder.match(/^[A-Z][A-Z](\-|_|\[)/)
              if(!matchLoc) {
                matchLoc = data.folder.match(/^\[[A-Z][A-Z]\]/)
              } 
              if(matchLoc?.length){
                systemInfo.location = matchLoc[0].replace(/(\-|_|\[)/, "") ?? "-"
              }
            }
            if(syskey.match(systemInfoRegex.RegExpMalwareName)?.filter(n => n)?.length){
              systemInfo.malware_name = sys[syskey]
            }
            if(syskey.match(systemInfoRegex.RegExpAntivirus)?.filter(n => n)?.length){
              systemInfo.antivirus = sys[syskey]
            }
            if(syskey.match(systemInfoRegex.RegExpComputerName)?.filter(n => n)?.length){
              systemInfo.computer_name = sys[syskey]
            }
            if(syskey.match(systemInfoRegex.RegExpIP)?.filter(n => n)?.length){
              systemInfo.ip = sys[syskey]
            }
            if(systemInfo.location === "-" && syskey.match(systemInfoRegex.RegExpLocation)?.filter(n => n)?.length){
              systemInfo.location = sys[syskey]
            }
            if(syskey.match(systemInfoRegex.RegExpMachineID)?.filter(n => n)?.length){
              systemInfo.machine_id = sys[syskey]
            }
            if(syskey.match(systemInfoRegex.RegExpOperationSistem)?.filter(n => n)?.length){
              systemInfo.operation_sistem = sys[syskey]
            }
            if(syskey.match(systemInfoRegex.RegExpPath)?.filter(n => n)?.length){
              systemInfo.path = sys[syskey]
            }
            if(syskey.match(systemInfoRegex.RegExpDateCompromised)?.filter(n => n)?.length){
              systemInfo.date_time_compromised = new Date(sys[syskey])
            }
          }
        }
        for(const credData of data.password){
          const pass: IPassData = {
            flag_employee: "-",
            flag_thirdparty: "-",
            flag_user: "-",
            login: "-",
            password: "-",
            url: "-",
            storage: "-",
            flag_edu: "-",
            flag_gov: "-"
          }
          for(const credKey in credData){
            if(credKey.match(userPassRegex.RegExpLogin)?.filter(n => n)?.length){
              pass.login = credData[credKey]
            }
            if(credKey.match(userPassRegex.RegExpPassword)?.filter(n => n)?.length){
              pass.password = credData[credKey] 
            }
            if(credKey.match(userPassRegex.RegExpUrl)?.filter(n => n)?.length){
              pass.url = credData[credKey]
            }
            if(credKey.match(userPassRegex.RegExpStorage)?.filter(n => n)?.length){
              pass.storage = credData[credKey]
            }
          }
          let flagEmployee = "-"
          let flagUser = "-"
          let flagThirdParty = "-"
          let flagGov = "-"
          let flagEdu = "-"
          const emailRegex = /@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/;
          const urlRegex = /[https?|android]:\/\/(?:www\.)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
          const urlDomain = pass.url.match(urlRegex)?.length > 1 && pass.url.match(urlRegex)[1]
          const emailDomain = pass.login.match(emailRegex)?.length > 1 && pass.login.match(emailRegex)[1]
          if (emailDomain && urlDomain && emailDomain === urlDomain) {
            flagEmployee = urlDomain
          } else if (emailDomain !== urlDomain){
            if(emailDomain){
              flagThirdParty = emailDomain
            }
            if(urlDomain){
              const match = urlDomain.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})$/);
              const domain = match ? match[0] : urlDomain;
              flagUser = domain
              const eduRegex = /\.edu(\.\w{2,3})?/
              const govRegex = /\.gov(\.\w{2,3})?/
              const eduTld = urlDomain.match(eduRegex)
              const govTld = urlDomain.match(govRegex)
              let findGov = null
              let findEdu = null
              if(eduTld?.length){
                findEdu = edu.find(d => d.domain === eduTld[0])
                flagEdu = findEdu.country ?? "-"
              }
              if(govTld?.length){
                findGov = gov.find(d => d.domain === govTld[0])
                flagGov = findGov.country ?? "-"
              }
            }
          }
          const isDevice = pass.url?.match(/android:\/\//)
          if(isDevice?.length && pass.url){
            const deviceTld = pass.url.match(/@([\w.]+)\//)[0]
            const arr = deviceTld.replace(/@|\//g, "").split(".")
            arr.shift()
            arr.unshift("android")
            flagUser = arr.join(".")
          }
          pass.flag_edu = flagEdu ?? "-"
          pass.flag_gov = flagGov ?? "-"
          pass.flag_employee = flagEmployee ?? "-"
          pass.flag_thirdparty = flagThirdParty ?? "-"
          pass.flag_user = flagUser ?? "-"
          finalData.push({
            ...systemInfo, ...pass,
            id: `sector-one-${crypto.randomUUID()}`,
            storage: "-",
            date_time_added: new Date()
          })
        }
      }
    })
    if(!fs.existsSync(`${process.cwd()}/result`)){
      fs.mkdirSync(`${process.cwd()}/result`);
    }
    finalData = finalData.map((d) => {
      if(d.password !== "-" && d.url !== "-" && d.login !== "-"){
        return d
      }
    }).filter(d => d)
    fs.writeFileSync(`result/${filename}.json`, JSON.stringify(finalData))
    await mongodb.updateDowloadStatusByFileId(file_id, "formatted")
  }
  
  public async removeFile(filename: string, file_id: string){
    const removedMimeType = filename.replace(/\.[a-z]{3,4}$/, "")
    const extractedFolder =  `${process.cwd()}/_td_files/documents/extracted/${removedMimeType}`
    const filteredFolder =  `${process.cwd()}/_td_files/documents/filtered/${removedMimeType}`
    const file =  `${process.cwd()}/_td_files/documents/${filename}`
    if(fs.existsSync(file)){
      fs.rmSync(file, {recursive: true})
    }
    if(fs.existsSync(extractedFolder)){
      fs.rmSync(extractedFolder, {recursive: true})
    }
    if(fs.existsSync(filteredFolder)){
      fs.rmSync(filteredFolder, {recursive: true})
    }

    await mongodb.updateDowloadStatusByFileId(file_id, 'removed')
  }

  public parseAndGroupJSON(filename: string) {
    const parentDirData = fs.readdirSync(`_td_files/documents/filtered/${filename}`)
    const data = []
    parentDirData.forEach(dir => {
      const pathData = `_td_files/documents/filtered/${filename}/${dir}`
      const parsedData: ParsedJSONData = {
        folder: dir,
        system: [],
        password: []
      }
      const passFiles = globSync(path.join(pathData, "**", 'pass*.txt'), {nodir: true, nocase: true});
      passFiles.forEach(passFile => {
        const parsePassTxtToJson = this.parsePasswordTextToJsonArray(fs.readFileSync(passFile, {encoding: 'utf-8'}))
        parsedData.password = [...parsedData.password, ...parsePassTxtToJson]
      })
      const sysFiles = globSync(path.join(pathData, "**", 'sys*.txt'), {nodir: true, nocase: true});
      sysFiles.forEach(sysFile => {
        const parseSysTxtToJson = this.parseSystemTextToJson(fs.readFileSync(sysFile, {encoding: 'utf-8'}))
        parsedData.system = [...parsedData.system, parseSysTxtToJson]
      })
      data.push(parsedData)
    })
    return data
  }

  public async filterTxt(filename: string) {
    const searchDir = `${process.cwd()}/_td_files/documents/extracted/${filename}`; 
    const targetDir = `${process.cwd()}/_td_files/documents/filtered/${filename}`;
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const patterns = ["pass*.txt", "sys*.txt"];
    
    patterns.forEach((pattern) => {
        const files = globSync(path.join(searchDir, "**", pattern));
        files.forEach((file) => {
            const splitDir = file.replace(`${process.cwd()}/_td_files/documents/extracted/${filename}`, "")
            const fileName = path.basename(file);
            const targetPath = path.join(targetDir+splitDir, fileName);
            fs.mkdirSync(targetDir+splitDir , { recursive: true})
            fs.copyFileSync(file, targetPath);
            // console.log(`Copied: ${file} -> ${targetPath}`);
        });
    });
    
    console.log("All matching files have been copied.");
  }
  public parseSystemTextToJson (text: string): Record<string, any> {
    const lines = text.split("\n").map(line => line.trim()).filter(line => line);
    const result: Record<string, any> = {};
    let currentKey: string | null = null;

    for (const line of lines) {
        if(line.match(systemInfoRegex.RegExpStealerName)?.length){
          result["Malware_Name"] = line.match(systemInfoRegex.RegExpStealerName)[0]
        }
        if (line.startsWith("- ")) {
          const match = line.match(/^- (.+?):\s*(.*)$/);
          if (match) {
            const key = match[1].trim().replace(/\s+/g, "_");
            const value = match[2].trim();
            result[key] = value || null;
            currentKey = key;
          } else {
            const value = line.replace("- ", "").trim();
            if (Array.isArray(result[currentKey])) {
                result[currentKey].push(value);
            } else {
                result[currentKey] = [value];
            }
          }
        } else if (line.startsWith("-")) {
          currentKey = null;
        } else if (currentKey && line.match(/^\s*-/gi)) {
          const value = line.replace(/^\s*-/gi, "").trim();
          if (Array.isArray(result[currentKey])) {
            result[currentKey].push(value);
          } else {
            result[currentKey] = [value];
          }
        } else {
          const lineData = line.split(':')
          const key = lineData[0]?.trim()
          const value = lineData[1]?.trim()
          if(key && value){
            result[key] = [value];
          }
        }
    }
    return result;
  };
  public parsePasswordTextToJsonArray (text: string): Record<string, string>[] {
    const entries = text.split("\n\n").map(entry => entry.trim()).filter(entry => entry);

    const result: Record<string, string>[] = entries.map(entry => {
        const lines = entry.split("\n");
        const item: Record<string, string> = {};
        lines.forEach(line => {
            const [key, ...valueParts] = line.split(":");
            if (key && valueParts.length > 0) {
                item[key.trim()] = valueParts.join(":").trim();
            }
        });
        return item;
    });
    return result;
  };
}
export default Parser
