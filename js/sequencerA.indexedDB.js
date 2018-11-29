var database=(function() {
       
    "use strict";
    
    if (!('indexedDB' in window)) {
        alert('This browser doesn\'t support IndexedDB. Need to get yourself a modern browser.');
    }
    
    const DB_NAME="sequencerA";
    const DB_VERSION=1;

    let db;
    let dbReady=Promise.resolve(1);
    let ajaxReady;
    let sequenceLength=32;
    let project={bpm:120, sounds:[]};
    let projectIndex=[];

    // Start the application by opening indexedDB and completing the page
    databaseOpen(completePage);

    // To avoid global variables the application exposes following variables local to this immediately invoked function
    return {
        db: ()=>db,
        sequenceLength: ()=>sequenceLength,
        project: ()=>project,
        projectIndex: ()=>projectIndex
    };


    function databaseOpen(callback) {
        let request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = function(e) {
            dbReady=new Promise(function(resolve,reject) {
                ajaxReady=resolve;
            });
            
            db=e.target.result;
            e.target.transaction.onerror = databaseError;

            createStores();
            
            ['sounds1.zip','sounds2.zip'].forEach(function(zipfile){
                installFile(zipfile);
            });
        }
        
        request.onsuccess = function(e) {
            dbReady.then(()=>{
                db=e.target.result;
                callback();
            });
        };

        request.onerror = databaseError;
    };

    // Callback after database opened. Complete page with logo and sound details
    function completePage() {
        let transaction=db.transaction(["blobs","images","sounds"],"readonly");
        
        transaction.onerror=databaseError;

        let images=transaction.objectStore("images");
        let sounds=transaction.objectStore("sounds");
        let blobs=transaction.objectStore("blobs");

        // Set application logo
        images.openCursor().onsuccess = function(e1) {
            blobs.get(e1.target.result.value.id).onsuccess=function(e2) {
                document.getElementById("logo").setAttribute("src",URL.createObjectURL(e2.target.result.data));
            }
        }

        // Build table body with available sound samples. ()
        let row=-1;
        let tbody='<tbody id="main-tbody">';
        sounds.index("name").openCursor().onsuccess = function(e1) {
            let cursor=e1.target.result;
            if(cursor) {
                if (cursor.value.num==1) {
                    row++;
                    tbody+=addSound(row, cursor.value.name);
                    project.sounds.push({
                        id: cursor.value.id, name:cursor.value.name, mute:false, single:false, volume:0.5, stereo:0.0, format:cursor.value.type,
                        sequence:[0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0]
                    });  
                }   
                cursor.continue();
            } else {
                tbody+="</tbody>";
                document.getElementById("main-tbody").innerHTML=tbody;
            }
        }

        // List available chains and sequences in drag/drop container
        buildProjectIndex().then(()=>fillDragfrom());

        // Set version number in page footer
        document.getElementById("version").innerHTML=DB_VERSION;
    }

    // Create the database tables (stores)
    function createStores() {
        db.createObjectStore("blobs", { keyPath: "id", autoIncrement: true});

        db.createObjectStore("images", { keyPath: "id"});

        let sounds=db.createObjectStore("sounds", { keyPath: "id" });
        sounds.createIndex("name","name", {unique:true});
        sounds.createIndex("category","category", {unique:false});
        sounds.createIndex("num","num", {unique:false});

        let projects=db.createObjectStore("projects", { keyPath: "id", autoIncrement: true });
        projects.createIndex("abbr","abbr", {unique:true});
        projects.createIndex("last_modified_unix","last_modified_unix", {unique:false});
    }

    // Common database error routine
    function databaseError(e) {
        console.error('An IndexedDB error has occurred', e);
    }

    async function installFile(zipfile) {
        // Retrieve zip file of sample sounds and images from server and insert into indexedDB
        let url="https://cdn.rawgit.com/xsf3190/sequencerA/master/"+zipfile;
        try {
            let response=await fetch(url);
            let blob=await response.blob();
            loadFile2DB(blob);
        } catch(e) {
            console.error("Failed!", e);
            alert(e);
        }
    }

    // Build projectIndex array of user's sequences and chains
    function buildProjectIndex() {
        return new Promise(function (resolve, reject) {
            let projects=db.transaction("projects").objectStore("projects").openCursor(null,"prev");
            projects.onsuccess = function(e) {
                let cursor=e.target.result;
                if(cursor) {
                    let obj={"id":cursor.value.id, "name":cursor.value.name, "abbr": cursor.value.abbr, "last_modified":cursor.value.last_modified};
                    if (cursor.value.sequence) {
                        obj.sequence=cursor.value.sequence;
                        obj.chainid=cursor.value.chainid;
                    } else {
                        obj.sequences=cursor.value.sequences;
                    }
                    projectIndex[cursor.value.id]=obj;     
                    cursor.continue();
                } else {
                    resolve(1);
                }
            }
            projects.onerror=function(e) {
                console.error(e);
                reject(Error,"buildProjectIndex ERROR");
                alert(e.errorCode);
            }
        });
    };

    // function for dynamic sorting
    function compareValues(key, order) {
        return function(a, b) {
            if(!a.hasOwnProperty(key) || 
                !b.hasOwnProperty(key)) {
                console.log("no property:"+key+":")
                return 0; 
            }
    
            const varA = (typeof a[key] === 'string') ? 
            a[key].toUpperCase() : a[key];
            const varB = (typeof b[key] === 'string') ? 
            b[key].toUpperCase() : b[key];
    
            let comparison = 0;
            if (varA > varB) {
            comparison = 1;
            } else if (varA < varB) {
            comparison = -1;
            }
            return (
            (order == 'desc') ? 
            (comparison * -1) : comparison
            );
        };
    }

    // Fill top-right section with locally stored Chains and Sequences.
    function fillDragfrom() {    
        //projectIndex.sort(compareValues("id", "desc"));
        let dragfrom=document.getElementById("dragfrom");
        for (let i in projectIndex) {
            let element="";
            if (projectIndex[i].sequence && projectIndex[i].chainid===null) {
                element=document.createElement("span");
                element.setAttribute("class","sequence-btn");
                element.setAttribute("id",projectIndex[i].id);
                element.setAttribute("draggable","true");
                element.setAttribute("title",projectIndex[i].name+' Last modified:'+projectIndex[i].last_modified);
                let text=document.createTextNode(projectIndex[i].abbr);
                element.appendChild(text);
            }
            if (projectIndex[i].sequence===undefined) {
                element=document.createElement("div");
                element.setAttribute("class","chain-btn");
                element.setAttribute("id",projectIndex[i].id);
                element.setAttribute("draggable","true");
                let span=document.createElement("span");
                span.setAttribute("class","chain-abbr");
                span.setAttribute("title",projectIndex[i].name+' Last modified:'+projectIndex[i].last_modified);
                let text=document.createTextNode(projectIndex[i].abbr);
                span.appendChild(text);
                element.appendChild(span);
                let span2=document.createElement("span");
                span2.setAttribute("class","fas fa-caret-down");
                element.appendChild(span2);
            }
            if (element) {
                dragfrom.appendChild(element);   
            }    
        }
    };

    // load contents of downloaded zip file into indexedDB stores
    function loadFile2DB(zipfile) {
        JSZip.loadAsync(zipfile).then(function(zip) {
            let allBlobPromises=[];
            zip.forEach(function (relativePath, zipEntry) {
                allBlobPromises.push(
                    zip.files[relativePath].async('blob').then(function(data) {
                        putBlob(zipEntry.name, data);
                    }, function error(e) {
                        console.log(e); 
                    })
                );
            });
            Promise.all(allBlobPromises).then(()=>{
                ajaxReady(1);
            });
        });
    };

    // Add a row to the sounds / images object store
    function putBlob(filename, data) {
        let type=filename.substring(filename.indexOf(".")+1);
        let name=filename.substring(0,filename.indexOf("."));
        let num=parseInt(name.match(/\d+/),10);
        let category=name.match(/^[A-Za-z_-]*/);

        let transaction=db.transaction(["blobs","sounds","images"],"readwrite");
        transaction.onerror = databaseError;

        let blobs=transaction.objectStore("blobs");
        blobs.add({data:data}).onsuccess=function(e) {
            let id=e.target.result;
            if (type=="jpeg") {
                transaction.objectStore("images").add({id:id, name:name, type:type}).onsuccess=function(e) {
                    console.log("Inserted successfully - "+filename);
                }                
            } else {
                transaction.objectStore("sounds").add({id:id, name:name, type:type, num:num, category:category[0]}).onsuccess=function(e) {
                    console.log("Inserted successfully - "+filename);
                }
            }
        }
    }   

    // Build next sound in both object and DOM
    function addSound(row, name) {        
        let tr='<tr data-y="'+row+'">';

        tr+='<td class="btn-sound" id="sound'+row+'" data-help="Click to change sample."><span>'+name+'</span></td>';
        tr+='<td class="centre"><button type="button" class="btn-single" data-help="Solo button: only play channels with S selected.">S</button>';
        tr+='<button type="button" class="btn-mute" data-help="Mute button: turn off audio for channels with M selected.">M</button></td>';
        tr+='<td><div data-help="Volume of channel: Left = 0 / Right = 10."><label for="volume'+row+'">V</label><input class="btn-volume" id="volume'+row+'" type="range" min="0" max="1" step="0.1"></div>';
        tr+='<div data-help="Panning of channel: Left/Right."><label for="stereo'+row+'">P</label><input class="btn-pan" id="stereo'+row+'" type="range" min="-1" max="1" step="0.1"></div></td>';
        let darker=false;
        for (let j=0; j<sequenceLength; j++) {
            if (j%4==0) {
                darker=!darker;
            }
            if (darker) {
                tr+='<td class="darker">';
            } else {
                tr+='<td>';
            }
            tr+='<button type="button" class="cell" data-x="'+j+'"></button></td>';
        }
        
        [1,2,3,4].forEach(function(i) {
            if (row%2==0) {
                let slot=row*2+i; // row=0 => 1,2,3,4  row=2 => 5,6,7,8   row=4 => 9,10,11,12 ...
                if (slot<=16) {
                    tr+='<td class="chain" rowspan="2"><div class="dropnum" id="dropnum_'+slot+'"><span class="fas fa-cube"></span>'+slot+'</div><div class="dropto" id="dropto_'+slot+'"></div></td>';
               } else {
                    tr+='<td class="chain"></td>';
               }
            }
        })
        
        tr+='</tr>';    
        return tr;
    }

    let deferredPrompt;

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault();
        // Stash the event so it can be triggered later.
        deferredPrompt = e;
        // Update UI notify the user they can add to home screen
        btnAdd.style.display = 'block';
    });

    btnAdd.addEventListener('click', (e) => {
        // hide our user interface that shows our A2HS button
        btnAdd.style.display = 'none';
        // Show the prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        deferredPrompt.userChoice
          .then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
              console.log('User accepted the A2HS prompt');
            } else {
              console.log('User dismissed the A2HS prompt');
            }
            deferredPrompt = null;
          });
    });

})();