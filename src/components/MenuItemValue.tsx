import { useObserver } from "../hooks/useObserver"
import { Tdescr } from "../system/sdds/types"
import { useMenuNavContext } from "./MenuNavContext"
import { TCommonProps } from "./itemDisplayComponents/CommonProps"
import Edit from "./itemDisplayComponents/Edit"
import Select from "./itemDisplayComponents/Select"

type TmenuItemValueProps = {
    item : Tdescr
}

function MenuItemValue({item} : TmenuItemValueProps) {
    const nav = useMenuNavContext()
    const editing = nav.focusedRow.value === item.idx && nav.editing.value === 1   

    useObserver(nav.focusedRow)
    useObserver(nav.editing)
    const {value, setValue, observer} = useObserver(item,false)

    function onEditStarted(){
        observer.current.setActive(false)
        nav.editStarted(item)
    }

    function onCancelEdit(){
        observer.current.setActive(true)
        nav.cancelEdit()
    }

    function onEditDone(){
        nav.editCanceled()
        observer.current.setActive(true)
    }

    function onFinishEdit(value: any){
        onCancelEdit()
        item.setValue(value)
    }

    const commonProps : TCommonProps = {
        item,
        editing,

        setValue,
        onStartEdit: ()=>{},
        onEditStarted,
        onCancelEdit,
        onFinishEdit,
        onEditDone
    }

    //how does this work in jsx below? #1
    //const test = {...commonProps, item: item as TenumDescr}

    switch(item.baseType){
        case 'enum': 
            return <Select {...commonProps}></Select>
        default:
            return <Edit {...commonProps}></Edit>
    }
    return <></>
}

export default MenuItemValue