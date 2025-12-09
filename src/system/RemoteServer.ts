import { TobservedItem, Tpath, TstructDescr } from "./sdds/types";
import { TjsTimeout } from "./types"
import { IComm } from "./CommInterface";

type TremoteServerStatus = "created"|"connected"|"reconnecting"|"closed"

type TconnectionTask = "close"|"open"|"linked"|"closeOpen"

class Tconnection{
	private Fstruct : TstructDescr|null
	private Fpath : Tpath
	private Fport : number
	public Ftask : TconnectionTask
	
	get task() { return this.Ftask }
	get pathStr(){ return this.Fpath.join('.') }

	flagForClose() { this.Ftask = "close" }

	get canBeRecycled() { return this.Ftask = "close" }
	
	reactivate(_data : TobservedItem){
		this.Fstruct = _data.struct;
		this.Fpath = _data.path.slice()
		this.Ftask = "closeOpen"
	}

	onWsReconnect(){
		if (this.Ftask === "linked") this.Ftask = "open"
	}

	dataReceived(){
		switch(this.Ftask){
			case "open" : 
				this.Ftask = "linked"
				break;
			
			//do nothing, connectionThread will handle this
			case "close": break 
		}
	}

	get struct() { return this.Fstruct }
	get port() { return this.Fport }

	constructor(_data: TobservedItem, _port : number){
		this.Fport = _port
		this.Fpath = _data.path.slice()
		this.Fstruct = _data.struct
		this.Ftask = "open"
	}
}

type TrrContext = {
	nextIdx : number
}
const TrrContextInitial : TrrContext = {
	nextIdx : 0
}

class TconnectionList{
	static FIRST_PORT = 1

	private Flist : (Tconnection|null)[] = [];
	
	findForRecycling() : Tconnection|null{
		let res = null
		this.iterate(c=>{
			if (c.canBeRecycled){
				res = c
				return false
			}
		})
		return res
	}

	allocate(_data : TobservedItem){
		//first try to find a connection for recycling
		let newConn = this.findForRecycling()
		if (newConn){
			newConn.reactivate(_data)
			return newConn
		}

		//if no for recycling found, try to find an empty slot and insert a new onw
		this.Flist.forEach((conn,idx)=>{
			if (!conn){
				const c = new Tconnection(_data,idx+TconnectionList.FIRST_PORT)
				this.Flist[idx] = c
				newConn = c
				return false
			}
		})
		if (newConn) return newConn

		//if nothing found, append a new connection to the list
		newConn = new Tconnection(_data,this.Flist.length + TconnectionList.FIRST_PORT)
		this.Flist.push(newConn)
		return newConn
	}

	findByPort(_port : number){
		const idx = _port - TconnectionList.FIRST_PORT
		if (idx < 0 || idx >= this.Flist.length) return null
		return this.Flist[idx]
	}

	findByStruct(_struct : TstructDescr): Tconnection|null{
		let res = null
		this.iterate(c=>{
			if (_struct === c.struct){
				res = c
				return false
			}
		})
		return res
	}

	_iterate(conns : (Tconnection|null)[], _cb : (conn : Tconnection) => void|boolean){
		let visitedIdx = -1
		conns.forEach((c,idx)=>{
			visitedIdx = idx
			if (c) return _cb(c)    //break if callback returns false
		})
		return visitedIdx
	}

	iterate(_cb : (conn : Tconnection) => void|boolean){
		return this._iterate(this.Flist,_cb)
	}

	iterateRR(_cb : (conn : Tconnection) => void|boolean, _rr : TrrContext){
		let start = _rr.nextIdx
		if (start < 0 || start >= this.Flist.length) start = 0 
		const conns = [...this.Flist.slice(start),...this.Flist.slice(0,start)]
		const lastVisited = this._iterate(conns,_cb)
		_rr.nextIdx=lastVisited+1
	}

	setToClosed(port : number){
		const conn = this.findByPort(port)
		if (!conn) return null
		if (conn.task === "close") {
			this.Flist[this.Flist.indexOf(conn)] = null
			return null
		}
		else if (conn.task === "closeOpen"){
			conn.Ftask = "open";
		}
		return conn
	}

	clear(){
		this.Flist = [];
	}

	log(){
		this.iterate(c => console.log(c))
	}
}

class TremoteServer extends TstructDescr{
	private Fhost : string
	private Fcomm : IComm;
	//private Fsocket : Sockette|SerialConnector|undefined
	private Fstatus : TremoteServerStatus = "created"
	private FdataStruct : TstructDescr

	private Fconns : TconnectionList
	private FconnTimer : TjsTimeout|null = null
	private FtypeTimer : TjsTimeout|null = null
	private FconnRR : TrrContext = TrrContextInitial

	private FcheckActivateTimer : TjsTimeout|null = null
	private FupdatesDisabled : boolean = false
	
	get dataStruct() { return this.FdataStruct }
	get status() { return this.Fstatus }
	set status(_val) { 
		this.Fstatus = _val
		this.emitOnChange()
	}

	private host = "";

	constructor(_comm : IComm, _host : string){
		super(`${_host}`)
		this.Fcomm = _comm
		this.host = _host;
		this.FdataStruct = new TstructDescr("data")
		this.push(this.FdataStruct)
		this.Fhost = _host
		this.Fconns = new TconnectionList()

		this.Fcomm.callbacks.subscribe({
			onopen: () => this.onOpen(),
			onmessage: (msg : string) => this.onMessageStr(msg),
			onreconnect: () => {this.onReconnecting()},
			onclose: () => this.onClose(),
			onerror: e => console.log('Error1:', e)
		})
		//this.connect()
		//const menuDefStr = '[{"type":1,"opt":0,"name":"cntSwitch","value":"on","enums":["on","off"]},{"type":1,"opt":0,"name":"Fcnt","value":5},{"type":66,"opt":0,"name":"sub","value":[{"type":1,"opt":0,"name":"filter","value":10},{"type":36,"opt":0,"name":"value21","value":7.50},{"type":4,"opt":0,"name":"time1","value":1000},{"type":1,"opt":0,"name":"led","value":"off","enums":["on","off"]}]},{"type":1,"opt":0,"name":"filter","value":10},{"type":36,"opt":0,"name":"value","value":0.00},{"type":36,"opt":0,"name":"fValue","value":0.00}]'
		//this.handleTypeMessage(menuDefStr)
	}

	connectionThread(){
		this.FconnTimer = null

		//first check for connections to be closed -> reduce the traffic with the server
		this.Fconns.iterateRR(c=>{
			if (c.task === "close" || c.task == "closeOpen"){
				this.send(`U ${c.port}`)
				return this.triggerConnectionThread(1000)
			}
		},this.FconnRR)

		this.Fconns.iterateRR(c=>{
			if (c.task === "open"){
				this.send(`L ${c.port} ${c.pathStr}`)
				return this.triggerConnectionThread(1000)
			}
		},this.FconnRR)
	}
	
	triggerConnectionThread(_timeout : number = 0) { 
		if (this.FconnTimer) clearTimeout(this.FconnTimer)
		this.FconnTimer = setTimeout(()=>{ this.connectionThread() },_timeout) 
	}
	
	get connectionThreadRunning() { return this.FconnTimer !== null }
	
	inObserved(observed : TobservedItem[], conn: Tconnection){
		let oIdx = -1
		observed.forEach((o,idx)=>{
			if (o.struct === conn.struct){
				oIdx = idx
				return false
			}
		})
		return oIdx >= 0
	}

	_checkActivate(){
		this.FcheckActivateTimer = null

		//retireve a list of all structures beeing observed
		const observed : TobservedItem[] = []
		this.FdataStruct.collectObserved(observed,[])

		//find all active connections for items no longer observed and flag to be closed
		this.Fconns.iterate(conn=>{
			if (!this.inObserved(observed,conn)) conn.flagForClose()
		})

		//for all items that are observed initiate a connection if not already there
		observed.forEach(o=>{
			const conn = this.Fconns.findByStruct(o.struct) 
			if (!conn) this.Fconns.allocate(o)
			else if (conn.canBeRecycled) conn.reactivate(o)
		})

		//finally start connection thread to do the work
		if (!this.connectionThreadRunning) this.triggerConnectionThread()

	}

	//this is called in types.ts
	checkActivation(){
		if (this.FcheckActivateTimer) clearTimeout(this.FcheckActivateTimer)
		this.FcheckActivateTimer = setTimeout(()=>{this._checkActivate()},100)
	}
	
	installUpdateObservers(){
		this.FdataStruct.iterate((element,path)=>{
			if (!element.isStruct){
				element.observers.add(item=>{
					if (!this.FupdatesDisabled) 
						this.send(path.join('.') + '=' + item.value)    //toDo: debounce?
				})
			}
		})
	}

	static LINK_MSG_PATTERN = /^(\d+)\s+(.+)/
	handleLinkMessage(port : number, data : string){

		//remove seperator at the end (this is a bug in my ssds lib in C++)
		//if (data.slice(-1) === ",") data=data.slice(0,-1)

		//split into port, firstItem, rest

		const match = data.match(TremoteServer.LINK_MSG_PATTERN)
		if (!match) return

		const first = parseInt(match[1])
		let values;
		try{
			values = JSON.parse(match[2])
		}
		catch(err){
			console.log("parsing json failed: " + err)
		}

		//console.log("handleLinkData data=",values)

		const conn = this.Fconns.findByPort(port)
		if (!conn){
			console.log("conn undefined... send U")
			this.send("U " + port)	//close port if not assoziated with anything
			return
		}

		//ignore messages to ports that are about to be closed
		if (conn.task == "close" || conn.task == "closeOpen"){
			return;
		}

		conn.dataReceived()             //task=linked ->stop requesting
		this.FupdatesDisabled = true
		try{
			conn.struct?.readValueArray(values,first)
		}
		finally {
			this.FupdatesDisabled = false
		}
	}

	handleUnlinkMessage(port : number){
		if (this.Fconns.setToClosed(port)){
			this.triggerConnectionThread();
		}
	}

	static ERR_MSG_PATTERN = /^\s*(\d+)\s*(.*)/
	handleErrorMessage(port: number, data : string){
		console.log(`handleErrorMessage data = "${data}"`)
		const match = data.match(TremoteServer.ERR_MSG_PATTERN)
		console.log(match)
		if (!match) return

		const errCode = parseInt(match[1])
		const errDescr = match[2]
		console.log(errDescr)
		//const conn = this.Fconns.findByPort(port)
		switch(errCode){
			//couldn't parse port -> nothing we can do about it
			case 1: return
			
			//invalid path
			case 2: return
			
			//path resolved but doesn't point to a struct
			case 3: return

			//path resolved but pointer=nil
			case 4: return

			//invalid port
			case 5: 
				return this.Fconns.setToClosed(port)

			//INVALID CMD
			case 6: return

			//maximum number of clients reached
			case 100: 
				console.log("asdlkfjakdsjflasd")
				this.Fcomm.callbacks.emitError("Max number of clients exceeded")
				return this.Fcomm.close()       //connection has been rejected... stop trying
		}
	}

	handleTypeMessage(port : number, data : string){
		//console.log(data)
		this.stopTypeRequests();
		/**
		 * toDo: check if the structure is the same like our local one
		 * in this case we don't have to clear and build it again
		 */
		this.FdataStruct.clear();
		if (this.FdataStruct.childs.length === 0){
			this.FdataStruct.parseJsonStr(data)
			//this.FdataStruct.log()
			this.installUpdateObservers()
			this.emitOnChange()
		}
	}

	static MSG_PATTERN = /([a-z,A-Z])\s(\d+)\s?(.*)/
	onMessageStr(input : string){
		//split into cmd and payload
		const match = input.match(TremoteServer.MSG_PATTERN)
		//console.log(match)
		if (!match) {
			console.log(input);
			return;
		}

		const cmd = match[1];
		const port = parseInt(match[2]);
		const data = match[3];

		switch(cmd){
			case "l": return this.handleLinkMessage(port,data)
			case "u": return this.handleUnlinkMessage(port)
			case "E": 
				console.log(input)
				return this.handleErrorMessage(port,data)
			case "B": return //this.sendTypeReq()
			case "t": 
				console.log(input);
				return this.handleTypeMessage(port,data)
		}
	}

	onOpen(){
		console.log("connected")
		this.status = "connected"
		this.requestTypes()
		this.Fconns.iterate(c=>{
			c.onWsReconnect()
		})
		this.triggerConnectionThread(100)
	}

	onClose(){
		console.log("closed")
		//this.Fconns.clear();
		this.status = "closed"
		this.stopTypeRequests();
	}

	onReconnecting(){
		console.log("remoteServer: reconnect")
		this.status = "reconnecting"
		this.stopTypeRequests();
	}

	send(_msg : string){
		if (this.status !== "connected") return
		console.log(`sending "${_msg}"`)
		this.Fcomm.send(_msg);
	}
	doSendTypeReq(){
		this.send("T")
	}

	stopTypeRequests(){
		if (this.FtypeTimer) clearInterval(this.FtypeTimer)
	}

	sendTypeReq(){
		this.doSendTypeReq()
		if (this.FtypeTimer) clearInterval(this.FtypeTimer)
		this.FtypeTimer = setInterval(()=>{
			console.log("timeout: sendTypeReq again")
			this.doSendTypeReq()
		},2000)
	}

	requestTypes(){
		this.sendTypeReq()
	}

}

export default TremoteServer