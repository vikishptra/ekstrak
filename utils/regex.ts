import stealer from '../stealer.json'
class SystemInfoRegex {
  private static instance: SystemInfoRegex 
  private stealerName = stealer

  public RegExpMachineID = new RegExp("hwid", 'gi')
  public RegExpPath = new RegExp("path", 'gi')
  public RegExpIP = new RegExp("ip|ipaddr|ipaddress|ip address|ip addr|ip_address", 'gi')
  public RegExpLocation = new RegExp("country|country code", 'gi')
  public RegExpDateCompromised = new RegExp("local date|local_date|localdate|local_time|localtime|local time", 'gi')
  public RegExpOperationSistem = new RegExp("os", 'gi') 
  public RegExpComputerName = new RegExp("computer|computername|computer name|pc name|hostname|machinename", 'gi')
  public RegExpAntivirus = new RegExp("antivirus|anti virus|anti_virus", 'gi')
  public RegExpMalwareName = new RegExp("stealer|stealer_family|malware|malware_name", 'gi')
  public RegExpStealerName = new RegExp(this.stealerName.join("|"), 'gi')
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}
  public static getInstance() {
    if(!SystemInfoRegex.instance) {
      this.instance = new SystemInfoRegex()
    }
    return this.instance
  }
}
class UserPassRegex {
  private static instance: UserPassRegex 
  
  public RegExpLogin = new RegExp("login|username|user", 'gi')
  public RegExpPassword = new RegExp("password|PASS", 'gi')
  public RegExpUrl = new RegExp("url|uri|host|", 'gi')
  public RegExpStorage = new RegExp("soft|browser|application", 'gi')
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}
  public static getInstance() {
    if(!UserPassRegex.instance) {
      this.instance = new UserPassRegex()
    }
    return this.instance
  }
}

const systemInfoRegex = SystemInfoRegex.getInstance()
const userPassRegex = UserPassRegex.getInstance()
export { systemInfoRegex, userPassRegex }