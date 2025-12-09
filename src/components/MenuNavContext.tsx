import { createContext, ComponentChildren } from "preact";
import { useContext } from "preact/hooks";
import { useRef } from "preact/hooks";
import { TnumberDescr, Tdescr, TstructDescr, Tobserver } from "../system/sdds/types";

class TmenuNavStateClass extends TstructDescr{
    private FfocusedRow = new TnumberDescr();
    private Fediting = new TnumberDescr();
    private FrootStruct : TstructDescr;
    private FcurrStruct : TstructDescr;
	private Fcb : Tobserver | undefined;
    status = new Tdescr;

    get focusedRow() { return this.FfocusedRow }
    get editing() { return this.Fediting }

    get focusedItem() { return this.FcurrStruct.childs[this.FfocusedRow.value] }
    get struct() { return this.FcurrStruct }

    get isRoot() { return this.struct == this.FrootStruct}
    
    constructor(_struct : TstructDescr){
        super()
        this.FrootStruct = _struct
		this.Fcb = this.FrootStruct.observers.add((d)=>{
			this.Fcb?.setActive(false)
			this.enterStruct(this.FrootStruct)
			this.Fcb?.setActive(true)
		})
        this.FcurrStruct = _struct
    }

    logStatus(){
        const focIdx = this.focusedItem.idx
        this.status.value = `acitveRow = ${focIdx}, editing=${this.Fediting.value}`
    }

    focusNext(){
        const v = this.FfocusedRow.value
        if (v + 1 >= this.FcurrStruct.childs.length) return
        this.FfocusedRow.value = this.FfocusedRow.value + 1;
        this.logStatus()
    }

    focusPrev(){
        const v = this.FfocusedRow.value
        if (v <= 0) return
        this.FfocusedRow.value = v-1;
        this.logStatus()
    }

    enterStruct(_struct : TstructDescr){
        this.FcurrStruct.emitOnChange()
        this.FcurrStruct = _struct as TstructDescr
        this.FfocusedRow.value = 0
    }

    startEdit(){
        const item = this.focusedItem
        if (item.hasChilds) this.enterStruct(item as TstructDescr)
        else{
            this.Fediting.value = 1
        }
        this.logStatus()
    }

    editStarted(item : Tdescr){
        this.Fediting.setValue(1,false)
        this.FfocusedRow.setValue(item.idx,false)
        this.logStatus()
    }

    leaveStruct(){
        if (this.struct.parent){
            this.struct.emitOnChange()
            this.FcurrStruct = this.struct.parent
            this.FfocusedRow.value = 0
        }
        this.logStatus()
    }

    cancelEdit(){
        this.Fediting.value = 0
        this.logStatus()
    }

    editCanceled(){
        this.Fediting.setValue(0,false)
        this.logStatus()
    }
} 


const MenuNavContext = createContext<TmenuNavStateClass>(new TmenuNavStateClass(new TstructDescr()))

type TmenuNavProviderProps = {
    children : ComponentChildren
    root : TstructDescr
}

function MenuNavProvider({root, children} : TmenuNavProviderProps) {
    const navState = useRef(new TmenuNavStateClass(root));
	return (
        <MenuNavContext.Provider value={navState.current}>
            {children}
        </MenuNavContext.Provider>
    )
}

export default MenuNavProvider

export function useMenuNavContext(){ 
    return useContext(MenuNavContext)
}