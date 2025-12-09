import useFocusHtmlElement from "../../hooks/useFocusHtmlElement"
import { TstructDescr } from "../../system/sdds/types"
import { useMenuNavContext } from "../MenuNavContext"
import { TCommonProps } from "./CommonProps"


function Edit({item, editing, onEditStarted, onCancelEdit, onEditDone, onFinishEdit} : TCommonProps) {
    const nav = useMenuNavContext()
    const ref = useFocusHtmlElement(editing)
    //console.log("render Edit",item.value)
    function onFocus(){
        ref.current?.select()
        onEditStarted()
    }

    function onClick(){ 
        if (item.hasChilds) nav.enterStruct(item as TstructDescr) 
    }

    function cancelEdit(){ 
        onCancelEdit()
    }

    function onKeyDown(e : KeyboardEvent){
        switch(e.code){
            case "Escape": case "ArrowLeft": return cancelEdit()
            case "Enter": {
                onFinishEdit(ref.current?.value)
                e.preventDefault()  //prevent trigger onSubmit...
            }
        }
    }
    
    function myOnEditDone(){
        onEditDone()
        if (ref.current) ref.current.value = item.value
    }

    let type = "text"
    if (item.baseType == "float" || item.baseType == "int" || item.baseType == "uint"){
        type = "number"
    } 

    return (
        //for mobiles devices (only android?) the form tag is necessary to show the enter button
        //on the softkeyboard... on the other hand it seems like the event in the onKeyDown/Press has no
        //information about the pressed key on mobiles in PREACT, so we are killing 2 birds with one 
        //stone here...
        <form onSubmit={(e)=>{
            onFinishEdit(ref.current?.value)
            e.preventDefault()
        }}>
            <input 
                className={item.readonly?'readonly':''} 
                type={type} 
                name={item.name}
                value={item.value}
                readOnly={!item.editable}

                onFocus={onFocus}
                onBlur={myOnEditDone}
                onKeyDown={onKeyDown}
                onMouseDown={onClick}

                ref={ref}
            />
        </form>
    )
}

export default Edit