//jQuery.event.props.push('dataTransfer');
    
    // projectIndex catalogs all sequences and chains held in local Storage
    //var projectIndex = JSON.parse(localStorage.getItem("projectIndex"));  
    //if (!projectIndex) {
    //    projectIndex=[];
    //}
    

    // Create new "hSounds" array for the project
    //var hSounds=[];
    //for (i in project.sounds) {
    //    hSounds[i]=new Howl({format: project.sounds[i].format, volume: project.sounds[i].volume, src: url+"/"+project.sounds[i].id, stereo: project.sounds[i].stereo});
    //}  



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
    




    //Check if value  exists for property in projectIndex returning object if exists.
    function existsIndex(property, value) {
        
        let exists=false;
        let compareValue="";
        if (typeof value === 'string' || value instanceof String) {
            compareValue=value.toUpperCase();
        } else {
            compareValue=value;
        }
        /*
        for (i in projectIndex) {
            switch (property) {
                case "name": if (projectIndex[i].name.toUpperCase()==compareValue) {exists=true;}; break;
                case "abbr": if (projectIndex[i].abbr.toUpperCase()==compareValue) {exists=true;}; break;
                case "key":  if (projectIndex[i].key==value)  {exists=true;}; break;
                default: sweetAlert("ERROR. property "+property+" not handled in function existsIndex.");
            }
            
            if (exists) {
                return i;
            }
        }
        */
        return null;
    }   

    

    



    function playSound(id, format) {
        let sample=new Howl({format: format, volume: 0.5, src: url+"/"+id});
        sample.play();
    }    
    
    /*
    $.contextMenu({
        selector: '.btn-sound', 
        trigger: "left",
        callback: function(key, opt) {
            // Get the triggering element id
            let triggerid=$("#"+opt.$trigger[0].id);
            
            if (key=="replace") {
                let sampled=triggerid.data("sampled");  //e.g. 205-wav-bongo2 or undefined if no sound previously sampled
                if (!sampled) {
                    sweetAlert("Play a sample sound first to replace "+opt.$trigger[0].innerText);
                    return false;
                }
                //if (confirm("Replace: "+opt.$trigger[0].innerText + " with " + sampled.name)) {
                triggerid.text(sampled.name);
                let y=triggerid.closest("tr").data("y");
                hSounds[y]=new Howl({format: sampled.format, volume: 0.5, src: url+"/"+sampled.id});
                project.sounds[y].name=sampled.name;
                project.sounds[y].format=sampled.format;
                project.sounds[y].id=sampled.id;
                triggerid.removeData("sampled"); 
                return true;
            }
            
            let i1=key.indexOf("-");
            let i2=key.lastIndexOf("-");
            let id=key.substring(0,i1);
            let format=key.substring(i1+1,i2);
            let name=key.substring(i2+1);
            
            playSound(id, format);
            triggerid.data("sampled",{"id":id, "format":format, "name": name}); // e.g. set data to 205-wav-bongo2
            
            return false; // means keep submenu open
        },
        items: sounds
    });
    */
        
    String.prototype.paddingLeft = function (paddingValue) {
        return String(paddingValue + this).slice(-paddingValue.length);
    };
    
    String.prototype.hashCode = function() {
        let hash=0;
        let char="";
        if (this.length == 0) return hash;
        for (i = 0; i < this.length; i++) {
            char = this.charCodeAt(i);
            hash = ((hash<<5)-hash)+char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    };
    
