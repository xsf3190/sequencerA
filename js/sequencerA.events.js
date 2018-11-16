$(function() {

    "use strict";

    let db=database.db();
    let sequenceLength=database.sequenceLength();
    let project=database.project();
    let projectIndex=database.projectIndex();

    let hSounds=[];
    let interval=null;
    let pos=0;
    let chains=[];
    let chains_pos=0;  
    let help = $("#help-text");
    help.addClass("help-default");
       
    //var dropto = $(".dropto");

    let save = $("#btn-save");
    let load = $("#btn-load");
    let play = $("#start-stop");
    let playicon = play.find("span");
    let bpm = $("#bpm");
    let reset = $("#btn-reset");
    let importFile = $("#btn-import");
    let clear = $("#btn-clear");
    let clearChain = $("#btn-clearchain");

    // User clicks SAVE button
    save.on("click",async function() {
        buildChain();
        let what;
        if (chains.length<2) {
            what="sequence";
        } else {
            what="chain";
        }

        const {value: name} = await swal({
            title: `Enter a name for this ${what}`,
            input: 'text',
            showCancelButton: true,
            inputValidator: (value) => {
                return !value && 'You need to enter something!'
            }
        })
          
        if (!name) return;

        let abbr=createAbbr(name);
        let now=new Date();
        let last_modified=now.getDate()+"/"+now.getMonth()+"/"+now.getFullYear()+" "+now.getHours().toString().padStart(2,"0")+":"+now.getMinutes().toString().padStart(2,"0");
        let last_modified_unix=now.getTime();
        let obj={chainid:null, name:name, abbr:abbr, last_modified_unix:last_modified_unix, last_modified:last_modified};

        if (what==="sequence") {
            obj.sequence=JSON.stringify(project);
        } else {
            let arr=[];
            chains.forEach(element => arr.push(element.id));
            obj.sequences=arr;
        }
        
        let tx=db.transaction("projects","readwrite").objectStore("projects");
        tx.oncomplete=()=>{
            console.log("tx.oncomplete");
        }

        tx.onabort=e=>{
            console.error("tx.onabort");
            swal({
                type: 'error',
                title: 'tx.onabort',
                text: 'Something went wrong adding Project!'+e.target.error.message
            }); 
        }

        new Promise((resolve, reject) => {
            let request=tx.add(obj);
            request.onsuccess=e=>resolve(e.target.result);
            request.onerror=e=>reject(Error,"DATABASE FAILED ON ADD PROJECT");
        })
        .then((projectid) => {
            projectIndex[projectid]=obj;
            let html;
            if (what==="chain") {
                chains.forEach(element => {
                    projectIndex[element.id].chainid=projectid; 
                    projectIndex[element.id].last_modified=last_modified;
                    projectIndex[element.id].last_modified_unix=last_modified_unix;
                    let request=tx.put(projectIndex[element.id]);  // Update the link in indexedDB
                    $("#"+element.id).remove(); // Remove sequence from Dragfrom
                });
                html='<div class="chain-btn" id="'+projectid+'" draggable="true">';
                html+='<span class="chain-abbr" title="'+name+' Last modified:'+last_modified+'">'+abbr+'</span>';
                html+='<span class="fas fa-caret-down"></span>';
                html+='</div>';
            } else {
                html='<span class="sequence-btn" id="'+projectid+'" draggable="true" title="'+name+' Last modified:'+last_modified+'">'+abbr+'</span>';
            }
            $("#dragfrom").prepend(html);
        })     
        .catch((e) => {
            console.error('ERROR ADD PROJECT');
            swal({
                type: 'error',
                title: 'ERROR ADDING PROJECT',
                text: 'Something went wrong adding Project!'+e.target.error.message
            }); 
        });
    })

    // Create abbreviation for name
    function createAbbr(name) {
        let name2=name.replace(/[^0-9A-Z]+/gi," ");  // Remove non alphanumeric characters
        name2=name2.replace(/\s+/g, ' ');            // Reduce multiple spaces to one space for word split

        let words=name2.split(" ",2);                // Get first 2 words 
        let abbr="";
        if (words.length>1) {                        // If name comprised of more than 1 space separated word 
            abbr=words[0].substring(0,1)+            //   then create initial abbreviation from first letter of each word
                 words[1].substring(0,1);
        } else {
            abbr=name2.substring(0,2);               // Else initial abbreviation is first 2 letters of name
        }
        abbr=abbr.toUpperCase();                    

        // Check if abbreviaion already used, in which case change it until unique by adding suffixes in order from 1..9 and A..Z
        let sfx="123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let sfxi=-1;
        let uniq=false;
        let xAbbr="";
        while (!uniq) {
            xAbbr=existsIndex("abbr",abbr);
            if (!xAbbr) {
                uniq=true;
                break;
            }
            sfxi++;
            if (sfxi>sfx.length) {
                swal({type:'error', title:'ERROR ADDING PROJECT', text: "Exhausted all "+sfx.length+" suffixes for name "+name+". Enter a different name."});
                return;
            }
            abbr=abbr.substring(0,2)+sfx[sfxi];
        }
        return(abbr);
    }

    // Check a given value exists for a property in projectIndex
    function existsIndex(property, value) {
        let exists=false;
        let compareValue="";
        if (typeof value === 'string' || value instanceof String) {
            compareValue=value.toUpperCase();
        } else {
            compareValue=value;
        }
        for (let i in projectIndex) {
            switch (property) {
                case "abbr": if (projectIndex[i].abbr.toUpperCase()==compareValue) {exists=true;}; break;
                case "name": if (projectIndex[i].name.toUpperCase()==compareValue) {exists=true;}; break;
                case "id"  : if (projectIndex[i].key==value)                       {exists=true;}; break;
                default: sweetAlert("ERROR. property "+property+" not handled in function existsIndex.");
            }
            if (exists) {
                return i;
            }
        }
        return null;
    }       

    // Change a sound sample in the sequence
    $("#main-tbody").on("click",".btn-sound>span",async function() {
        let that=$(this);
        that.css({"font-style":"italic","text-decoration":"underline"});
        let name=that.text();
        let num=parseInt(name.match(/\d+/),10);
        let category=name.match(/^[A-Za-z_-]*/);

        // Build list of categories and numbered sounds
        const categoryList = await buildCategoryList(category[0]);
        const numList = await buildNumList(category[0],num);

        swal({
            title: 'Choose another sound to replace '+name,
            html: categoryList+numList,
            width: '80%',
            focusConfirm: false,
            showCloseButton: true,
            showCancelButton: true,
            preConfirm: () => [$('input[name=swal2-radio-category]:checked').val(), parseInt($('input[name=swal2-radio-num]:checked').val()), $('input[name=swal2-radio-num]:checked').next().text()]
        }).then((result)=>{
            that.css({"font-style":"normal","text-decoration":"none"});
            if (result.value) {
                let y=that.closest("tr").data("y");
                name=result.value[0].concat(result.value[2]);
                that.text(name);
                project.sounds[y].id=result.value[1];
            }
        });     
    });

    // Category list implemented as set of radio buttons
    function buildCategoryList(category) {
        return new Promise(function (resolve, reject) {
            let html='<ul class="swal2-radio-container">';
            let request=db.transaction("sounds","readonly").objectStore("sounds").index("category").openCursor(null,'nextunique');
            request.onsuccess = function(e) {
                let cursor=e.target.result;
                let checked;
                if(cursor) {
                    if (cursor.value.category===category) {
                        checked="checked";
                    }
                    html+='<li class="swal2-flex-item"><input type="radio" id="'+cursor.value.category+'" name="swal2-radio-category" value="'+cursor.value.category+'" '+checked+'><label class="swal2-label" for="'+cursor.value.category+'">'+cursor.value.category+'</label></li>';
                    cursor.continue();
                } else {
                    html+='</ul>';
                    resolve(html);
                }
            }
            request.onerror=function(e) {
                console.error(e);
                reject(Error,"buildCategoryList ERROR");
                swal(e.errorCode);
            }
        })
    }

    // Build list of radio buttons for selected sound category
    function buildNumList(category, num) {
        return new Promise(function (resolve, reject) {
            let html='<ul class="swal2-radio-container" id="swal2-radio-numlist">';
            let request=db.transaction("sounds","readonly").objectStore("sounds").index("num").openCursor();
            request.onsuccess = function(e) {
                let cursor=e.target.result;
                let checked;
                if(cursor) {
                    if (cursor.value.category===category) {
                        if (cursor.value.num==num) {
                            checked="checked";
                        }
                        html+='<li class="swal2-flex-item"><input type="radio" id="radio'+cursor.value.num+'" name="swal2-radio-num" value="'+cursor.value.id+'" '+checked+'><label class="swal2-label" for="radio'+cursor.value.num+'">'+cursor.value.num+'</label></li>';
                    }
                    cursor.continue();
                } else {
                    html+='</ul>';
                    resolve(html);
                }
            }
            request.onerror=function(e) {
                console.error(e);
                reject(Error,"buildNumList ERROR");
                swal(e.errorCode);
            }
        })
    }
    
    // User selects sound category; rebuild list of numbered sounds for the category.
    $("body").on("click",".swal2-container input[name='swal2-radio-category']", async function() {
        let category=$(this).val();
        const html = await buildNumList(category,1);
        $('.swal2-container #swal2-radio-numlist').replaceWith(html);
    });

    // Use selects numbered sound. Load selected sound, if necessary, and play it.
    $("body").on("click",".swal2-container input[name='swal2-radio-num']", function() {
        let soundid = parseInt($('.swal2-container input[name=swal2-radio-num]:checked').val());
        if (hSounds[soundid]) {
            hSounds[soundid].play();
        } else {
            loadSound(soundid).then(()=>hSounds[soundid].play());
        }
    });
    
    // Import zip file button
    importFile.on("click", function(){
        $("#importfile").trigger("click");
    });
    
    // Clear chain button
    clearChain.on("click", function clearChain() {
        if ($(".dropto").hasClass("dropto-grey")) {
            swal({
                title: "Remove all sequences from current chain?",
                text: "This will not delete sequences permanently.",
                type: "warning",
                showCancelButton: true,
                confirmButtonText: 'Yes, please',
                cancelButtonText: 'No, keep them'
            })
            .then((result) => {
                if (result.value) {
                    $(".fa-times").trigger("click");
                }
            });
        }
    });
    
    $("#dragfrom").on("dragstart",".chain-btn, .sequence-btn, .chain-item",function(event) {
        let abbr=$("#"+event.target.id).text();
        let type="";
        if ($(this).hasClass("chain-btn")) {
            type="C";
        } else {
            type="S";
        }
        event.originalEvent.dataTransfer.setData("text/plain", JSON.stringify({"id":event.target.id, "abbr":abbr, "type": type}));
    });

    $("#main-tbody").on("dragover",".dropto",function(event) {
        event.preventDefault();
        event.originalEvent.dataTransfer.dropEffect = "copy";
    });    

    $("#main-tbody").on("drop",".dropto",function(event) {
        event.preventDefault();
        let drop = JSON.parse(event.originalEvent.dataTransfer.getData('text/plain'));
        let tgt=$(event.currentTarget);
        tgt.empty();
        if (drop.type==="S") {
            tgt.append('<span id="'+drop.id+'" class="chain-item" draggable="true">'+drop.abbr+'</span><span class="fas fa-times" title="Remove from Chain"></span><span class="fas fa-sync" title="Loop/ Edit Sequence"></span>');
            loadSequence(drop.id,false);
            $(".dropto").removeClass("dropto-orange");
            $(".dropnum").removeClass("dropnum-white");
            tgt.addClass("dropto-grey dropto-orange");
            tgt.prev($(".dropnum")).addClass("dropnum-white dropnum-full");
        }
        if (drop.type==="C") {
            if ($(".dropto").hasClass("dropto-grey")) {
                swal({
                    title: "Clear current chain ...",
                    text: "... and load '"+projectIndex[drop.id].name+"' ?",
                    type: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Yes, please',
                    cancelButtonText: 'No !!'
                }).then((result) => {
                    if (result.value) {
                        $(".fa-times").trigger("click");
                        loadChain(drop.id);
                    } 
                })
            } else {
                loadChain(drop.id);
            }
        }
    });
    
    function loadSequence(id,cellEnabled) {
        clear.trigger("click");
        project=JSON.parse(projectIndex[id].sequence);
        if (!project) {
            swal("SEQUENCE NOT LOADED FOR KEY :"+id+":");
            return;
        }
        // Set element properties in DOM based on sequence data loaded from localStorage
        bpm.text(project.bpm);
        for (let i in project.sounds) {
            $("#sound"+i).text(project.sounds[i].name);
            $("#volume"+i).val(project.sounds[i].volume);
            $("#stereo"+i).val(project.sounds[i].stereo);
            for (let j=0; j<sequenceLength; j++) {
                if (project.sounds[i].sequence[j]) {
                    $("tr[data-y="+i+"]").find("[data-x="+j+"]").addClass("selected");
                }
            }
        }
        if (cellEnabled) {
            $(".cell").prop("disabled",false);
        } else {
            $(".cell").prop("disabled",true);
        }
    }
    
    // Load chain sequences into RHS panel making the first sequence current
    function loadChain(chainid) {
        for (let i in projectIndex[chainid].sequences) {
            tgt=$("#"+chain[j].slot);
            key=chain[j].key;
            // Get the array index of projectIndex for next sequence in the chain
            xSequence=existsIndex("key",key);
            tgt.append('<span data-key="'+key+'" id="'+key+'" class="chain-item" draggable="true">'+projectIndex[xSequence].abbr+'</span><span class="fas fa-times" title="Remove from Chain"></span><span class="fas fa-sync" title="Loop/ Edit Sequence"></span>');
            if (j==0) {
                tgt.addClass("dropto-grey dropto-orange");
                tgt.prev($(".dropnum")).addClass("dropnum-white dropnum-full");  
                loadSequence(key,false);
            } else {
                tgt.addClass("dropto-grey");
            }
        }
    }
    
    // User clicks on chain element
    $("#main-tbody").on("click",".chain-item",function(){
        let that=$(this);
        let id=that.prop("id");
        $(".dropto").removeClass("dropto-orange");
        $(".dropnum").removeClass("dropnum-white");
        that.parent($(".dropto")).addClass("dropto-orange");
        that.parent().prev($(".dropnum")).addClass("dropnum-white dropnum-full");
        if (that.parent($(".dropto")).hasClass("yellow") && that.parent($(".dropto")).hasClass("dropto-orange")) {
            loadSequence(id,true);
        } else {
            loadSequence(id,false);
        }
    });
    
    // Click refresh button to open sequence for edit
    $("#main-tbody").on("click",".fa-sync",function() {
        let that=$(this).parent();
        //bug
        if (that.hasClass("yellow")) {
            that.removeClass("yellow");
            $(".cell").prop("disabled",true);
            project.sequencekey=0;
            return;
        }
        $(".yellow").removeClass("yellow");
        that.addClass("yellow");
        if (that.hasClass("dropto-orange")) {
            $(".cell").prop("disabled",false);
        } else {
            $(".cell").prop("disabled",true);
        }
    });

    // Remove sequence from chain
    $("#main-tbody").on('click','.fa-times', function(){
        let that=$(this).parent();
        if (that.hasClass("dropto-orange") || that.hasClass("yellow")) {
            clear.trigger("click");
        }
        that.empty().removeClass("dropto-grey dropto-orange yellow");
        that.prev($(".dropnum")).removeClass("dropnum-white dropnum-full");
    });
    
    // Sort on table column heading
    $("body").on('click', '.fa-sort-asc, .fa-sort-desc', function(){
        let classname=this.className;
        let sortdir=classname.substring(classname.lastIndexOf("-")+1);
        $("body").find("#popup-table tbody").replaceWith(listProject($(this).data("sortby"),sortdir));
        $(this).toggleClass("fa-sort-asc fa-sort-desc");
    });    
    
    $("#main-tbody").on("change",".btn-volume, .btn-pan",function() {
        let that = $(this);
        let btn=this.className;
        let y=that.closest("tr").data("y");
        let soundid=project.sounds[y].id;
        let value=parseFloat(that.val());

        if (btn=="btn-volume") {
            project.sounds[y].volume=value;
            hSounds[soundid].volume(value);
        }
        
        if (btn=="btn-pan") {
            project.sounds[y].stereo=value;
            hSounds[soundid].stereo(value);
        }
    });

    function resetCurrent() {
        $(".current").removeClass("current");
        $("#meter").find("[data-x=0]").addClass("current");
        pos = 0;
    }
        
    reset.click(function () {
        resetCurrent();
    });
    
    // Export all saved sequences (and chains) into zip file for user to download
    $("body").on("click","#exportall",function() {
        for (i in projectIndex) {
            if (i==0) {
                var zip = new JSZip();
            }
            zip.file(projectIndex[i].name+".json", localStorage.getItem(projectIndex[i].key));
        }
        zip.generateAsync({type:"blob"})
        .then(function(content) {  
            saveAs(content, "mysequences.zip");
        });
    })
    
    // Import one or more zip files containing exported sequences
    $("body").on("change","#importfile",function(evt) {  
        const now=new Date();
        var key=Math.round(now.getTime() / 1000);          
        function handleFile(f) {     
            JSZip.loadAsync(f)                                   // 1) read the zip file
            .then(function(zip) {
                zip.forEach(function (relativePath, zipEntry) {  // 2) process each entry
                    zip.files[relativePath].async('text')
                    .then(function(data) {
                        key++;
                        // Have to add this when settled down.
                        //saveSequence(JSON.parse(data), key);
                        fillDragfrom();
                    }); 
                });
            }, function (e) {
                sweetAlert("Error reading " + f.name + ": " + e.message);
            });
        } 
        help.html="";
        let files = evt.target.files;
        for (let i = 0; i < files.length; i++) {
            handleFile(files[i]);
        }
    })
    
    // Load project from localStorage through the popup dialog
    $("body").on("click",".fa-upload",function() {
        let tr=$(this).parent().parent();
        let key=parseInt(tr.data("key"));
        let indx=existsIndex("key",key);
        let context=$(this).data("context");
        // Load either sequence or chain
        const dropnumLength=16;
        if (context=="drag") {
            let i=dropnumLength+1;
            while(i--) {
                if ($("#dropnum_"+i).hasClass("dropnum-full")) {
                    if (i==dropnumLength) {
                        sweetAlert("All 16 chain slots in use.");
                        return;
                    }
                    i++;
                    break;
                }
            }
            if (i==-1) {
                i=1;
            }
            let tgt=$("#dropto_"+i);
            tgt.append('<span data-key="'+key+'" id="'+key+'" class="chain-item" draggable="true">'+projectIndex[indx].abbr+'</span><span class="fa fa-times" title="Remove from Chain"></span><span class="fa fa-sync" title="Loop/ Edit Sequence"></span>');
            $(".dropto").removeClass("dropto-orange");
            $(".dropnum").removeClass("dropnum-white");
            tgt.addClass("dropto-grey dropto-orange");
            tgt.prev($(".dropnum")).addClass("dropnum-white dropnum-full");
            
        } else {
            $("#ht2").trigger("click");
            if (projectIndex[indx].chain.length==0) {
                loadSequence(key,true);
            } else {
                loadChain(indx);
            }
        }
    })
    
    // Changing the project name in popup table
    $("body").on("change",".project-name",function() {
        let that=$(this);
        if (!that[0].checkValidity()) {
            sweetAlert(that.prop("title"));
            return;
        }
        
        let name=that.val().trim();
        let indx=existsIndex("name",name);
        if (indx) {
            sweetAlert("That name already taken.");
            return;            
        }
        
        let tr=that.parent().parent();
        let key=parseInt(tr.data("key"));  
        indx=existsIndex("key",key);
        projectIndex[indx].name=name;
        setLastModified(indx);
        localStorage.setItem("projectIndex",JSON.stringify(projectIndex));  
        
        fillDragfrom();
    })    
    
    // Changing the abbreviation
    $("body").on("change",".abbr",function() {
        let that=$(this);
        if (!that[0].checkValidity()) {
            sweetAlert(that.prop("title"));
            return;
        }
        let abbr=that.val().trim().toUpperCase();
        let indx=existsIndex("abbr",abbr);
        if (indx) {
            sweetAlert("That abbreviation already in use. Try again.");
            return;            
        }        
        let tr=that.parent().parent();
        let key=parseInt(tr.data("key"));  
        indx=existsIndex("key",key);
        projectIndex[indx].abbr=abbr;
        setLastModified(indx);
        
        localStorage.setItem("projectIndex",JSON.stringify(projectIndex));  
        
        fillDragfrom();
    })    
    
    // Retrieve project code from localStorage to show in dialog
    $("body").on("click",".fa-code",function() {
        let tr=$(this).parent().parent();
        let key=parseInt(tr.data("key"));
        let name=tr.find(".project-name").val();
        var blob = new Blob([localStorage.getItem(key)], {type: "text/plain;charset=utf-8"});
        saveAs(blob, name+".json");
    })    
    
    // Delete Sequence. Removes from localStorage and from any Chain.
    $("body").on("click",".fa-trash-o",function() {
        let tr=$(this).parent().parent();
        let key=parseInt(tr.data("key"));
        let name=tr.find("input").val();
        
        sweetAlert({
            title: "Sure you want to delete "+ name+"?",
            text: "You can use Export to backup all your work.",
            icon: "warning",
            buttons: true,
            dangerMode: true
        })
        .then((willDelete) => {
            if (willDelete) {
                for (i in projectIndex) {
                    if (projectIndex[i].key==key) {
                        projectIndex.splice(i,1);
                        break;
                    }
                }
                localStorage.setItem("projectIndex",JSON.stringify(projectIndex));
                localStorage.removeItem(key);
                tr.remove();
                fillDragfrom();
                $(".dropto").find("span[data-key="+key+"]").removeClass("dropto-grey dropto-orange").remove();
                if (project.sequencekey==key) {
                    clear.trigger("click");
                }
            }
        });    
    })


    
    // List Chains and Sequences. Prompt for Chain/Sequence new name on Save.
    function listProject(triggerby, sortdir) {
        let html="";
        let nb=0;
        
        function printtr(id, name, abbr, last_modified, chain) {
            nb++;
            html+='<tr data-key="'+id+'">';
            html+='<td class="centre"><span class="fa fa-upload"></span></td>';
            html+='<td>';
            html+='<input class="project-name" type="text" maxlength="50" value="'+name+'" title="Mandatory name (max. 50 characters)" required>';
            if (chain) {
                html+='<span class="fa fa-angle-right" title="Show/Hide component sequences"></span>';
            }
            html+='</td>';
            html+='<td><input class="abbr" type="text" maxlength="3" size="3" value="'+abbr+'" pattern="[A-Za-z0-9]{2}" title="Mandatory 2 character abbreviation" required></td>';
            html+="<td>"+last_modified+"</td>";
            html+='<td class="centre"><span class="fa fa-code"></span></td>';
            html+='<td class="centre"><span class="fa fa-trash-o"></span></td>';
            html+="</tr>";              
        }
        
        function makeBody() {
            html+='<tbody>';
            let chainSeq=[];
            let found=false;
            let key="";
            db.transaction("chains","readonly").objectStore("chains").openCursor().onsuccess = function(e) {
                let cursor=e.target.result;
                if(cursor) {
                    printtr(cursor.value.id, cursor.value.name, cursor.value.abbr, cursor.value.last_modified, cursor.value.chain, true);
                    cursor.continue();
                } 
            }
            db.transaction("sequences","readonly").objectStore("sequences").openCursor().onsuccess = function(e) {
                let cursor=e.target.result;
                if(cursor) {
                    if (!cursor.value.chainid) {
                        printtr(cursor.value.id, cursor.value.name, cursor.value.abbr, cursor.value.last_modified, cursor.value.chain, false);
                    }
                    cursor.continue();
                } 
            }

            html+='</tbody>';            
        }
        // TOBE COMPLETED
        /*
        if (triggerby!="btn-save" && triggerby!="btn-load") {
            projectIndex.sort(compareValues(triggerby, sortdir));
            makeBody();
            return html;
        }*/
        
        html='<div id="popup-container">';     
        if (triggerby=="btn-save") {
            html+='<div>';
            html+='<input id="project-name" type="text" maxlength="50" title="Mandatory name (max. 50 characters)" required ';
            let chainsLength=$(".chain-item").length;
            if (currentChain.key) {
                html+='value="'+currentChain.name+'">';
            } else if (chainsLength==0 && project.sequencekey) {
                let indx=existsIndex("key",project.sequencekey);
                html+='value="'+projectIndex[indx].name+'">';
            } else {
                html+='placeholder="Enter name">';
            } //bug
            html+='<button type="button" id="save">Save</button>';
            html+='<button type="button" id="exportall">Export All</button>';
            html+='</div>';
        }
        
        html+='<table id="popup-table">';
        html+='<thead><tr>';
        html+='<th>Load</th>';
        html+='<th>Name<span class="fa fa-sort-asc" data-sortby="name"></span></th>';
        html+='<th>Abbr<span class="fa fa-sort-asc" data-sortby="abbr"></span></th>';
        html+='<th>Last Modified<span class="fa fa-sort-asc" data-sortby="key"></span></th>';
        html+='<th>Code</th>';
        html+='<th>Delete</th>';
        html+='</tr></thead>';
     
        makeBody();
        
        if (triggerby=="btn-save" || triggerby!=="btn-load") {
            html+='</table></div>';
        }

        if (triggerby=="btn-load" && nb==0) {
            return false;
        }        
        return html;
    }  
    
    // User clicks single(S) button for a channel. S and M buttons are mutually exclusive
    $("#main-tbody").on("click",".btn-single",function () {
        let that=$(this);
        let y=that.closest("tr").data("y");
        that.toggleClass("single");
          if (that.hasClass("single")) {
            project.sounds[y].single=true;
        } else {
            project.sounds[y].single=false;
        }
        that.nextAll(".btn-mute").prop("disabled",project.sounds[y].single);
    });
    
    // User clicks mute button for a channel
    $("#main-tbody").on("click",".btn-mute",function () {
        let that=$(this);
        let y=that.closest("tr").data("y");
        that.toggleClass("muted");
        if (that.hasClass("muted")) {
            project.sounds[y].mute=true;
        } else {
            project.sounds[y].mute=false;
        }
        that.prevAll(".btn-single").prop("disabled",project.sounds[y].mute);
    });
    
    // Click&drag function
    var down = false;
        
    $(document).mouseup(function() {
        down = false;
    });
        
    function selectCell(that) {
        let x=that.data("x");
        let y=that.closest("tr").data("y");
        
        that.toggleClass("selected");
        
        if (that.hasClass("selected")) {
            project.sounds[y].sequence[x]=0.5;
        } else {
            project.sounds[y].sequence[x]=0.0;
        }
    }
    
    $("#main-tbody").on("mouseover",".cell",function(){
        if(down) {
            selectCell($(this));
        }
    });

    $("#main-tbody").on("mousedown",".cell",function(){
        down = true;
        selectCell($(this));
    });

    // Each sound enabled by new Howl object entry in hSounds array; only requested sounds are enabled in order to conserve client memory usage.
    function loadSound(soundid) {
        return new Promise(function (resolve, reject) {
            db.transaction("sounds","readonly").objectStore("sounds").get(soundid).onsuccess=function(e1) { 
                let type=e1.target.result.type;
                db.transaction("blobs","readonly").objectStore("blobs").get(soundid).onsuccess=function(e2) { 
                    hSounds[soundid]=new Howl({format:type, volume:0.5, stereo:0.0, src:URL.createObjectURL(e2.target.result.data)});
                    resolve();
                }
            }
        });
    }

    // Start or pause playing the sequence or chain
    play.click(function () {
        if (playicon.hasClass("fa-pause")) {
            clearInterval(interval);
        } else {
            buildChain();
            if (chains.length>0) {
                loadSequence(chains[chains_pos].id,chains[chains_pos].loop);
            }
            interval=setInterval(playSequence, 60000/(project.bpm * 4));   
        }
        playicon.toggleClass('fa-play fa-pause');
    });

    // Build array of sequences currently in Chain drop-to area
    function buildChain() {
        chains=[];
        chains_pos=0;
        $(".chain-item").each(function(index,value) {
            let id=$(this).prop("id");
            let parent=$(this).parent();
            chains.push({"id":id,"slot":parent.prop("id"),"loop":parent.hasClass("yellow")});
            if (parent.hasClass("dropto-orange")) {
                chains_pos=index;
            }
        });
    }
    
    // User clicks the meter to restart the sequence.
    $("#meter th").click(function () {
        let that=$(this);
        let x=parseInt(that.data("x"));

        if (x>=0) {
            $(".current").removeClass("current");
            pos=x;
            that.addClass("current");
        }
    });
    
    // Set BPM up or down using PLUS and MINUS buttons
    $(".bpm-num").click(function () {
        let increment=parseInt($(this).data("increment"));
        let bpm2=project.bpm+increment;
        if (bpm2<10 || bpm2>300) {
            sweetAlert("BPM must be between 10 and 300.")
            return;
        }
        project.bpm=bpm2;
        bpm.text(project.bpm);
        if (playicon.hasClass("fa-pause")) {
            clearInterval(interval);
            interval=setInterval(playSequence,60000/(project.bpm * 4));
        }
        });

    // Clear button - remove project and reset DOM elements 
    clear.click(function () {
        if (interval) {
            clearInterval(interval);
            playicon.removeClass("fa-pause").addClass("fa-play");
        }
        $("button").prop("disabled",false).removeClass("single").removeClass("muted").removeClass("selected");
        resetCurrent();
        $("#bpm").text("120");
        project.bpm=120; 
        project.name=null;
        for (let i in project.sounds) {
            $("tbody #volume"+i).val("0.5");
            $("tbody #stereo"+i).val("0");
            project.sounds[i].single=false;
            project.sounds[i].mute=false;
            project.sounds[i].volume=0.5;
            for (let j=0; j<sequenceLength; j++) {
                project.sounds[i].sequence[j]=0;
            }
        }
    });  

    // Play each note in the sequence array. Notes with no volume or muted are not played.
    function playSequence() {
        let single=false;
        for (let j in project.sounds) {
            if (project.sounds[j].single) {
                single=true;
                break;
            }
        }
        for (let i in project.sounds) {
            if (project.sounds[i].sequence[pos] && !project.sounds[i].mute) {
                if (!single || (single && project.sounds[i].single)) {
                    let soundid=project.sounds[i].id;
                    if (hSounds[soundid]) {
                        hSounds[soundid].play();
                    } else {
                        loadSound(soundid).then(()=>hSounds[soundid].play());
                    }
                }
            }
        }

        // Move the meter to next position after all sounds played
        $(".current").removeClass("current");
        
        pos=(pos+1)%sequenceLength;
        $("#meter th[data-x="+pos+"]").addClass("current");

        // End of sequence. IF playing chain then load/play next sequence in chain else loop on currently displayed sequence
        if (pos==0) {
            let chainsLength=chains.length;
            if (chainsLength>1) {
                function setmarker() {
                    let dropto=chains[chains_pos].slot;
                    let dropnum=dropto.replace("dropto","dropnum");                    
                    $("#"+dropto).toggleClass("dropto-orange"); 
                    $("#"+dropnum).toggleClass("dropnum-white");  
                }
                console.log(chains_pos); console.log(chains);
                setmarker();
                chains_pos=(chains_pos+1)%chainsLength; 
                loadSequence(chains[chains_pos].id,chains[chains_pos].loop);
                setmarker();
            }
        }
    }

});