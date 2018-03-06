/*global $*/

/*
TODO:
 - change World to accept a draw function instead of a background image
 - once WASD active, mouse is hidden till moved (clicking ineffective until visible)
PLANNING:
 - each building can be entered and has upgrades therein that are clickable
   while character is animated doing something (drinking, talking, etc) location-appropriate
NOTE:
 - expecting to change dragging into someting checked by the interact method of interactables
*/

/* HIERARCHY
world{}: each 'world' is effectively a screen
ex: town (outdoors), tavern, home, etc.
- GameObject(): most basic form of object, doesn't accept draw
- - tiles{...}: renderable objects - accepts draw function (allowing animation)
- - - statics{Tile}: base renderable, nothing fancy
- - - interactables{...}: accept a mHover, cHover for when mouse or character are over
- - - - plots{Plot}: interactable and show highlight on hover
- - - - UI{Interactable}: clickable or information-bearing elements - absolutely positioned
- - - - entities{Entity}: accept a move function, interactable
- - colliders{GameObject}: non-renderable GameObjects, block movement if in this object
*/

$(document).ready(function() {
  console.log("Javascript Ready")
  /*********************************
   ** Global Variable Definitions **
   *********************************/
  //DOM elements
  var canvas = $('#gameCanvas')[0];
  var ctx = canvas.getContext("2d");

  var keys = {};

  var worldStack = {};

  var mX;
  var mY;

  $("#gameCanvas").bind('mousemove', function(e) {
    mX = Math.round(e.pageX - $(this).offset().left);
    mY = Math.round(e.pageY - $(this).offset().top);
  });


  var resources = {};
  var lastResTick = new Date().getTime();

  //what object is currently held by the mouse
  var held = null;

  //Initializing town world
  worldStack['town'] = new World("town", basicWorldDraw, 0, 0, canvas.width, canvas.height, {bgImage: createImage("images/sky.png")});
  var activeWorld = 'town';

  resources['population'] = new Resource("Population", 0, 5, false, popResAI);
  resources['food'] = new Resource("Food", 0, 100, false, foodResAI);

  worldStack[activeWorld].gameObjects.tiles.interactables.plots['plot0'] = new Plot("plot0", 172, 144, 128, 128, 'images/grass-plot-128.png', ["<todo: add allowed>"]);

  /**************
   ** THE REST **
   **************/

  /**
  Resource = an item that can be incremented
  name = STR name of the object
  value = INT how much of the object is owned
  capacity = INT how much of the object can be owned currently
  isVisible = BOOL whether object is discovered yet
  checkIncrement = FUNC dictating when to increment
  **/
  function Resource(name, value, capacity, isVisible, checkIncrement) {
    this.name = name,
    this.value = value,
    this.capacity = capacity,
    this.isVivisble = isVisible,
    this.checkIncrement = checkIncrement
  }

  /**
  GameObject = most basic form of object
  tags[] = STR tags that apply to this object S.T. tags[0] is the object's key
  x, y = INT coords
  width, height = INT img width, height
  **/
  function GameObject(name, x, y, width, height) {
    this.tags = [name, "gameObject"];
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }
  //Shortcut for GameObject with Collider tag
  function Collider(name, x, y, width, height) {
    GameObject.call(this, name, x, y, width, height);
    this.tags.push("collider");
  }

  /**
  Tile = a renderable object that can be placed into the world
  tags[] = STR tags that apply to this object S.T. tags[0] is the object's key
  x, y = INT coords
  width, height = INT img width, height
  eImage = STR location to image source for entity
  drawStyle = FUNC function dictating how the entity should be drawn
  **/
  function Tile(name, x, y, width, height, eImage, drawStyle) {
    GameObject.call(this, name, x, y, width, height);
    this.tags.push("tile");

    this.image = createImage(eImage);

    this.draw = drawStyle;
  }
  //Shortcut for Tile with Static tag
  function Static(name, x, y, width, height, eImage, drawStyle) {
    Tile.call(this, name, x, y, width, height, eImage, drawStyle);

    this.tags.push('static');
  }

  /**
  Interactable = a Tile that can be hovered over and interacted with
  tags[] = STR tags that apply to this object S.T. tags[0] is the object's key
  x, y = INT coords
  width, height = INT img width, height
  eImage = STR location to image source for entity
  drawStyle = FUNC function dictating how the entity should be drawn
  mHover = FUNC dictating how to behave when mouse hovered
  cHover = FUNC dictating how to behave when character over
  interact = FUNC dictating how to behave when interacted with
  **/
  function Interactable(name, x, y, width, height, eImage, drawStyle, mHover, cHover, interact) {
    Tile.call(this, name, x, y, width, height, eImage, drawStyle);
    this.tags.push("interactable");

    this.mHover = mHover;
    this.cHover = cHover;
    this.interact = interact;
  }
  //Shortcut for Interactable with UI tag
  function UI(name, x, y, width, height, eImage, drawStyle, mHover, cHover, interact) {
    Interactable.call(this, name, x, y, width, height, eImage, drawStyle, mHover, cHover, interact);
    this.tags.push("UI");
  }
  /**
  Plot = an interactable that can be hovered over and interacted with for building buildings
  tags[] = STR tags that apply to this object S.T. tags[0] is the object's key
  x, y = INT coords
  width, height = INT img width, height
  eImage = STR location to image source for entity
  allowed[] = STR tags that are allowed
  **/
  function Plot(name, x, y, width, height, eImage, allowed) {
    Interactable.call(this, name, x, y, width, height, eImage, plotDraw, plotMHover, plotCHover, plotInteract);
    this.allowed = allowed;
    this.tags.push("plot");
  }


  /**
  Entity = an Interactable that can move
  tags[] = STR tags that apply to this object S.T. tags[0] is the object's key
  x, y = INT coords
  width, height = INT img width, height
  eImage = STR location to image source for entity
  drawStyle = FUNC function dictating how the entity should be drawn
  mHover = FUNC dictating how to behave when mouse hovered
  cHover = FUNC dictating how to behave when character over
  interact = FUNC dictating how to behave when interacted with
  move = FUNC dictating how to move
  **/
  function Entity(name, x, y, width, height, eImage, drawStyle, mHover, cHover, interact, move) {
    Interactable.call(this, name, x, y, width, height, eImage, drawStyle, mHover, cHover, interact);
    this.tags.push("entity");

    this.move = move;
  }

  /**
  World = an object containing all variables of the given World
  tags[] = STR tags that apply to this object S.T. tags[0] is the object's key
  drawStyle = FUNC dictating how to draw world bg
  x,y,mX,mY = INT dictating starting x,y of the window and maxX, maxY of the world
  **/
  function World(name, drawStyle, x, y, mX, mY, data) {
    this.tags = [name, "world"];
    this.draw = drawStyle;

    this.minX = 0;
    this.minY = 0;
    this.x = x;
    this.y = y;
    this.maxX = mX;
    this.maxY = mY;

    this.gameObjects = {
      tiles: {
        statics: {}, //tiles
        interactables: {
          plots: {}, //interactables
          UI: {}, //interactables
          entities: {} //entities
        }
      },
      colliders: {} //gameobjects
    };

    this.data = data;
  }

  //On click, interact with anything under the mouse
  $("#gameCanvas").click(function() {
    console.log("clicked at: " + mX + " " + mY)
    $.each(worldStack[activeWorld].gameObjects.tiles.statics.interactables, function (iKey, item) {
      $.each(item, function (key, value) {
        if (mX > value.x &&
            mX < item.x + item.width &&
            mY > item.y &&
            mY < item.y + item.height) {
          item.interact();
          if (item.tags.inArray("Plot")) {
            //TODO: Implement what happens when 'dropping' held item
            console.log("TODO: Implement what happens when 'dropping' held item");
          }
        }
      });
    });
  });

  /*
  Static(image, x, y, width, height)
    => Static(name, x, y, width, height, eImage, drawStyle)
  Tile(image, x, y, width, height, action)
    => actions moved to resources
  Plot(x, y, width, height, allowed) {
    => im thinking about it...
  }
  */
  /*****************/

  /**DragObjects are basically fancy buttons that move with the cursor where the
  * user clicked and are able to be dropped on an appropriate plot**/
  //They have both action, draw, and clicked
  function DragObject(type, nextType, image, x, y, width, height, offX, offY) {
    this.type = type,
    this.nextType = nextType,
    this.image = image,
    this.x = x,
    this.y = y,
    this.offX = offX,
    this.offY = offY,
    this.width = width,
    this.height = height,
    this.action = function() {
      this.x = mX - this.offX;
      this.y = mY - this.offY;
    },
    this.draw = function() { ctx.drawImage(this.image, this.x, this.y, this.width, this.height); },
    this.clicked = function() {
      //check if over a plot
      if (plots.filter(function(item, index) {
                          if (mX > item.x && mX < item.x+item.width && mY > item.y && mY < item.y+item.height) {
                            //since in a plot, check if that plot accepts this type of item
                            if (item.allowed.filter(function(item){
                                                      if(item == dragging.type){return true}
                                                      else{return false}
                                                    }).length > 0) {
                              plots[index].image = dragging.image; //set the plot's image to this image
                              plots[index].curType = dragging.type;
                              if (plots[index].allowed.indexOf(dragging.nextType) == -1) {
                                plots[index].allowed.splice(plots[index].allowed.indexOf(dragging.type), 1, dragging.nextType)
                              }
                              else {
                                plots[index].allowed.splice(plots[index].allowed.indexOf(dragging.type), 1)
                              }
                              //return true
                            }
                            else {
                              return false
                            }
                          }
                          else {
                            return false
                          }
                        }).length > 0) {
        //BUG: What does this do?
        tiles.splice(tiles.indexOf(this),1,new Tile(this.image, this.x, this.y, this.width, this.height, function() {}))
        dragging = null;
      }
      else { //clicked anything besides a valid Plot
        this.abort();
        dragging = null;
      }
    },
    this.abort = function() { //remove this tile from the tiles list
      tiles.splice(tiles.indexOf(this),1);
    }
  }

  function Button(image, selectedImage, x, y, width, height, onClick) {
    this.image = image,
    this.selectedImage = selectedImage,
    this.x = x,
    this.y = y,
    this.width = width,
    this.height = height,
    this.clicked = onClick,
    this.draw = function () {
      if (mX > this.x && mX < this.x+this.width && mY > this.y && mY < this.y+this.height) {
        ctx.drawImage(this.selectedImage, this.x, this.y, this.width, this.height);
      }
      else {
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
      }
    }
  }

  function Text(phrase, x, y) {
    this.phrase = phrase,
    this.x = x,
    this.y = y,
    this.draw = function() {
      //ctx.font="30px 8-BIT"
      ctx.font="30px Arial"
      ctx.fillStyle="#fff"
      ctx.fillText(this.phrase, this.x, this.y)
    }
  }

  function Counter(phrase, x, y, update) {
    this.phrase = phrase,
    this.x = x,
    this.y = y,
    this.update = update,
    this.draw = function() {
      //ctx.font="30px 8-BIT"
      ctx.font="30px Arial"
      ctx.fillStyle="#fff"
      ctx.fillText(this.update() + " " + this.phrase, this.x, this.y)
    }
  }
  //village0
  buttons.push(new Button(createImage("images/village128-Button.png"), createImage("images/village128-ButtonSelected.png"), 32, 432,96,96,function() {
    if (dragging != null) {
      dragging.abort();
      dragging = null;
    }
    dragging = new DragObject('village0', 'village1', createImage("images/village256.png"), mX, mY,96,96,mX-this.x,mY-this.y);
    tiles.push(dragging);

  }));
  //farm
  buttons.push(new Button(createImage("images/ovenT1-Button.png"), createImage("images/ovenT1-ButtonSelected.png"), 160, 432,96,96,function() {
    if (dragging != null) {
      dragging.abort();
      dragging = null;
    }
    dragging = new DragObject('farm', 'ranch', createImage("images/ovenT1.png"), mX, mY,96,96,mX-this.x,mY-this.y);
    tiles.push(dragging);

  }));

  texts.push(new Counter("Population", canvas.width/100, canvas.height/6, function () { return resources.filter(function(item) {return item.name == "Population"})[0].value }))
  texts.push(new Counter("Food", canvas.width/100, canvas.height/4, function () { return resources.filter(function(item) {return item.name == "Food"})[0].value }))
  //function Tile(image, x, y, width, height, action)
  /** set up the sky fills in an array for the draw loop **/
  //sky
  for (var ix = 0; ix <= canvas.width; ix+=32) {
    for (var iy = 0; iy <= canvas.height; iy+=32) {
      statics.push(new Static(createImage("images/grass-32.png"), ix, iy, 32, 32))
    }
  }

  function subtractDatesInSeconds(dold,dnew) {
    return Math.floor((dnew-dold)/1000)
  }

  function gameLoop() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle="#da9538";
    ctx.fillRect(0,0,canvas.width, canvas.height);
    //add to animation delay or trigger next animation
    delay >= 10 ? (delay = 0,
                    animateFrame()) : ++delay;
    if (subtractDatesInSeconds(lastResTick,new Date().getTime()) >= 1) {
      lastResTick = new Date().getTime();
      resources.map(function(item) {item.checkIncrement();});
    }
    statics.map(function(item) {item.draw();});
    plots.map(function(item) {item.draw();});
    plots.map(function(item) {item.action();});
    buttons.map(function(item) {item.draw();});
    tiles.map(function(item) {item.action();});
    tiles.map(function(item) {item.draw();});
    texts.map(function(item) {item.draw();});
    drawPlayerTile(0,0,state);
  }

  function animateFrame() {
    state = state >= 7 ? 0 : ++state;
  }

  //animated tile - old code, refactor when animation becomes important
  function drawPlayerTile(x,y,tileNum) {
    //Currently involves a wrapper, for any tile past 10, it assumes a new line down in the y axis
    var tileWidth = 64;
    var tileHeight = tileWidth;

    var playerSprites = new Image();
    playerSprites.src = "images/playerCharacter.png"

    drawTile(playerSprites, (tileNum % 10) * tileWidth, Math.floor(tileNum/10) * tileHeight, x, y, tileWidth, tileHeight);
  }
  function drawTile(spriteSrc,tileX,tileY,x,y,tileWidth,tileHeight) {
    ctx.drawImage(spriteSrc, tileX, tileY, tileWidth, tileHeight, x, y, tileWidth, tileHeight);
  }

  /*****************/
  function mainLoop() {
    //get active world
    aWorld = worldStack[activeWorld];

    //clear the screen
    clear();

    //move everything as needed
    $.each(aWorld.gameObjects.tiles.interactables.entities, function(key, value) {
      value.move();
    });

    $.each(aWorld.gameObjects.tiles.interactables, function(key, value) {
      $.each(value, function(key, value) {
        //mHover
        if (mouseIn(value.x,value.y,value.x+value.width,value.y+value.height)) {
          value.mHover();
        }
        //cHover
        /** TODO: undo this comment once character implemented
        if (coordsIn(value.x,value.y,value.x+value.width,value.y+value.height,aWorld.gameObjects.tiles.interactables.entities['character'].x,aWorld.gameObjects.tiles.interactables.entities['character'].y)) {
          value.cHover();
        }**/
      })
    })

    //draw the world and everything in it
    aWorld.draw();

    requestAnimationFrame(mainLoop);
  }

  //Movement Limiter
  function boundMovement(direction, entity, amount) {
    var curWorld = worldStack[activeWorld];
    //0=left
    if (direction == 0) {
      if (entity.x - amount <= curWorld.minX) {
        return entity.x;
      }
    }
    //1=right
    if (direction == 1) {
      if (entity.x + entity.width + amount >= curWorld.maxX) {
        return curWorld.maxX - entity.x - entity.width;
      }
    }
    //2=up
    if (direction == 2) {
      if (entity.y - amount <= curWorld.minY) {
        return entity.y;
      }
    }
    //3=down
    if (direction == 3) {
      if (entity.y + entity.height + amount >= curWorld.maxY) {
        return curWorld.maxY - entity.y - entity.height;
      }
    }

    return amount;
  }

  //Drawing AIs
  function staticDraw() {
    ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
  }

  function basicWorldDraw() {
    var ptrn = ctx.createPattern(this.data.bgImage, 'repeat');
    ctx.fillStyle = ptrn;
    ctx.fillRect(this.minX, this.minY, this.maxX, this.maxY);

    var tilesObj = this.gameObjects.tiles;
    if (Object.keys(tilesObj.statics) > 0) {
      $.each(this.gameObjects.tiles.statics, justDraw(key, value));
    }
    if (Object.keys(tilesObj.interactables.plots) > 0) {
      $.each(this.gameObjects.tiles.interactables.plots, justDraw(key, value));
    }
    if (Object.keys(tilesObj.interactables.entities) > 0) {
      $.each(this.gameObjects.tiles.interactables.entities, justDraw(key, value));
    }
    if (Object.keys(tilesObj.interactables.UI) > 0) {
      $.each(this.gameObjects.tiles.interactables.UI, justDraw(key, value));
    }
  }

  function plotDraw() {
    ctx.drawImage(this.image, this.x, this.y, this.width, this.height);

    if (held != null && this.allowed.filter(function(item) { return held.tags.inArray(item); }).length > 0) {
      ctx.drawImage(createImage("images/overlay.png"), this.x, this.y, this.width, this.height)
    }
  }

  //Movement AIs
  function defaultMovement() {
    speed = 5;
    //left
    if (keys[97] || keys[65]) {
      //console.log("left");
      this.x -= boundMovement(0,this,speed);
  	}
  	//right
  	if (keys[100] || keys[68]) {
      //console.log("right");
      this.x += boundMovement(1,this,speed);
  	}
    //up
    if (keys[87]) {
      //console.log("up");
      this.y -= boundMovement(2,this,speed);
    }
    //down
    if (keys[83]) {
      //console.log("down");
      this.y += boundMovement(3,this,speed);
    }
    console.log(this.name + ": " + this.x, ",", this.y)
  }

  //MHover AIs
  function plotMHover() {
    if (held != null &&
        this.allowed.filter(function(item) { return held.tags.inArray(item); }).length > 0) { //if held over a valid plot
      ctx.drawImage(createImage("images/highlight.png"), this.x, this.y, this.width, this.height)
    }
    else if (held == null) { //if mouse over but not held
      ctx.drawImage(createImage("images/overlay.png"), this.x, this.y, this.width, this.height)
    }
  }

  //CHover AIs
  function plotCHover() {
    //TODO: something for plotCHover
    console.log("TODO: something for plotCHover");
  }

  //Interact AIs
  function plotInteract() {
    //TODO: something for plotInteract
    console.log("TODO: something for plotInteract");
  }

  //Resource AIs
  function popResAI() {
    var incrementVal = numInPlots('smallVillage');
    //if will bring over capacity, bring to capacity instead
    if (this.value + incrementVal > this.capacity) {
      incrementVal = this.capacity - this.value;
    }
    //as long as not already at capacity
    if (incrementVal > 0) {
      //if there isn't enough food, only increase up to what there is food for
      var foodVal = resources['food'];
      if (foodVal - (this.value + incrementVal) <= 0) {
        incrementVal = foodVal - this.value;
      }
      //increment
      this.value += incrementVal;
    }
  }

  function foodResAI() {
    var incrementVal = numInPlots('smallFarm') - resources['population'];
    //if this increment will bring food negative
    if (this.value + incrementVal < 0) {
      //kill off as many pops as aren't fed
      incrementVal -= this.value;
      this.value = 0;
      resource['population'] -= incrementVal;
    }
    //or if will bring it over capacity
    else if (this.value + incrementVal > this.capacity) {
      //cap it at capacity
      this.value = this.capacity;
    }
    //lastly, if neither
    else {
      this.value += incrementVal;
    }
  }

  //Utility functions
  function clear() {
    ctx.setTransform(1,0,0,1,0,0);//reset the transform matrix as it is cumulative
    ctx.clearRect(0, 0, canvas.width, canvas.height);//clear the viewport after matrix is reset
  }

  function justDraw(key, value) {
    value.draw();
  }

  function createImage(path) {
    var newImage = new Image();
    newImage.src = path;
    return newImage;
  }

  function coordsIn(minX,minY,maxX,maxY,cX,cY) {
    if (cX > minX &&
        cX < maxX &&
        cY > minY &&
        cY < maxY) {
      return true;
    }
    return false;
  }

  function mouseIn(minX,minY,maxX,maxY) {
    return coordsIn(minX,minY,maxX,maxY,mX,mY);
  }

  //returns the number of occurrences of the searched-for tag in plots
  function numInPlots(searchStr) {
    var ret = 0;
    keyArr = Object.keys(worldStack[activeWorld].gameObjects.tiles.interactables.plots);
    for (var key in keyArr) {
      if (worldStack[activeWorld].gameObjects.tiles.interactables.plots[key].tags.inArray(searchStr)) {
        ++ret;
      }
    }
    return ret;
  }

  //Keypress and Input
  $(document).keydown( function(e)
  {
    //console.log("keypress: " + e.which);
    e.preventDefault();
    e.stopPropagation();
    keys[e.which] = true;
  });

  $(document).keyup( function(e)
  {
    e.preventDefault();
    e.stopPropagation();
    delete keys[e.which];
  });

  mainLoop();
});
