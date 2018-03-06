/*global $*/

/*
TODO:
 - change World to accept a draw function instead of a background image
 - once WASD active, mouse is hidden till moved (clicking ineffective until visible)
PLANNING:
 - each building can be entered and has upgrades therein that are clickable
   while character is animated doing something (drinking, talking, etc) location-appropriate
*/

/*********************************
 ** Global Variable Definitions **
 *********************************/
//DOM elements
var canvas = $('#gameCanvas')[0];
var ctx = canvas.getContext("2d");

var keys = {};

var worldStack = {};
worldStack['town'] = (new World("town", basicWorldDraw("sky.png"), 0, 0, canvas.width, canvas.height)
var activeWorld = "town";

/* ^^^^^^^^^^^^^^
*** hierarchy ***
world{}: each 'world' is effectively a screen
ex: town (outdoors), tavern, home, etc.
- GameObject(): most basic form of object, doesn't accept draw
- - tiles{...}: renderable objects - accepts draw function (allowing animation)
- - - statics{Tile}: base renderable, nothing fancy
- - - interactables{...}: accept a mHover, cHover for when mouse or character are over
- - - - plots{Interactable}: interactable and show highlight on hover
- - - - UI{Interactable}: clickable or information-bearing elements - absolutely positioned
- - - - entities{Entity}: accept a move function, interactable
- - colliders{GameObject}: non-renderable GameObjects, block movement if in this object
*/

var mX;
var mY;

/**
GameObject = most basic form of object
name = STR name of object
x, y = INT coords
width, height = INT img width, height
**/
function GameObject(name, x, y, width, height) {
  this.name = name;
  this.x = x;
  this.y = y;
  this.width = width;
  this.height = height;
}

/**
Tile = a renderable object that can be placed into the world
name = STR name of object
x, y = INT coords
width, height = INT img width, height
eImage = STR location to image source for entity
drawStyle = FUNC function dictating how the entity should be drawn
**/
function Tile(name, x, y, width, height, eImage, drawStyle) {
  GameObject.call(this, name, x, y, width, height);

  this.image = new Image();
  this.image.src = eImage;

  this.draw() = drawStyle;
}

/**
Interactable = a Tile that can be hovered over and interacted with
name = STR name of object
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

  this.mHover() = mhover;
  this.cHover() = cHover;
  this.interact() = interact;
}

/**
Entity = an Interactable that can move
name = STR name of object
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

  this.move() = move;
}

/**
World = an object containing all variables of the given World
name = STR name of World
drawStyle = FUNC dictating how to draw world bg
x,y,mX,mY = INT dictating starting x,y of the window and maxX, maxY of the world
**/
function World(name, drawStyle, x, y, mX, mY) {
  this.name = name;
  this.draw() = drawStyle;

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
        entities{} //entities
      }
    }
    colliders: {} //gameobjects
  };
}

/*****************/
var buttons = [];
var texts = [];
var tiles = [];
var plots = [];
var statics = [];
var resources = [];
var lastResTick = new Date().getTime();
var dragging = null;
$("#gameCanvas").bind('mousemove', function(e) {
  mX = Math.round(e.pageX - $(this).offset().left);
  mY = Math.round(e.pageY - $(this).offset().top);
});

$("#gameCanvas").click(function() {
  console.log("clicked at: " + mX + " " + mY)
  if (buttons.filter(function(item) {
                        if (mX > item.x && mX < item.x+item.width && mY > item.y && mY < item.y+item.height) {
                          item.clicked();
                          return true;
                        }
                      }).length <= 0) {
    if (dragging) {
      dragging.clicked();
    }
  }
})

//Shortcut for creating a new image cause its a pain
function createImage(path) {
  var newImage = new Image();
  newImage.src = path;
  return newImage;
}

function Resource(name, value, capacity, isVisible, checkIncrement) {
  this.name = name,
  this.value = value,
  this.capacity = capacity,
  this.isVivisble = isVisible,
  this.checkIncrement = checkIncrement
}
resources.push(new Resource("Population", 0, 5, false, function () {
  if (this.value + 1 <= this.capacity) {
    var foodVal = resources.filter(function(item){return item.name == "Population"})[0].value;
    if (foodVal - this.value >= 0) {
      this.value += 1 * plots.filter(function(item){return item.curType == "village0"}).length
    }
    else {
      //BUG: this needs to get the actual item, indexOf wont do it
      resources[resources.indexOf("Population")].value = this.value;
    }
  }
}));
resources.push(new Resource("Food", 0, 100, false, function () {
  this.value += 3 * plots.filter(function(item){return item.curType == "farm"}).length
  this.value -= resources.filter(function(item){return item.name == "Population"})[0].value
}));

/**Classes that draw to the canvas typically have a mixture of 3 additional funcs
 * action - run every tick like draw, meant to provide seperation of function from draw
 * draw - draw an image, like action but only for drawing the image saved with the object
 * clicked - what happens when clicked**/

//Draw an image that does nothing
function Static(image, x, y, width, height) {
  this.image = image,
  this.x = x,
  this.y = y,
  this.width = width,
  this.height = height,
  this.draw = function() { ctx.drawImage(this.image, this.x, this.y, this.width, this.height); }
}

//Tiles are statics that also have an action that must be done every tick
function Tile(image, x, y, width, height, action) {
  this.image = image,
  this.x = x,
  this.y = y,
  this.width = width,
  this.height = height,
  this.action = action,
  this.draw = function() { ctx.drawImage(this.image, this.x, this.y, this.width, this.height); }
}

//Plots are empty spaces where objects can be 'dropped' into
/**They are also effectively tiles which have a default action - display a guide
 * so it is easier to see the plot, but only if moused over or if an object that
 * the plot accepts is held currently**/
function Plot(x, y, width, height, allowed) {
  this.background = createImage('images/grass-plot-' + width + '.png'),
  this.image = null,
  this.x = x,
  this.y = y,
  this.width = width,
  this.height = height,
  this.curType = "",
  this.action = function () { //for overlays and highlighting due to mouse interaction
    if (mX > this.x && mX < this.x+this.width && mY > this.y && mY < this.y+this.height) {
      if (dragging != null && this.allowed.filter(function(item) { return item == dragging.type;}).length > 0) { //if dragging over a valid plot
        ctx.drawImage(createImage("images/highlight.png"), this.x, this.y, this.width, this.height)
      }
      else if (dragging == null) { //if mouse over but not dragging
        ctx.drawImage(createImage("images/overlay.png"), this.x, this.y, this.width, this.height)
      }
    }
    else { //if dragging but not over this particular plot
      if (dragging != null && this.allowed.filter(function(item) { return item == dragging.type;}).length > 0) {
        ctx.drawImage(createImage("images/overlay.png"), this.x, this.y, this.width, this.height)
      }
    }
  },
  this.draw = function() { //for drawing the actual image assigned to this Plot
    ctx.drawImage(this.background, this.x, this.y, this.width, this.height);
    if (this.image) { ctx.drawImage(this.image, this.x, this.y, this.width, this.height); }
  }
  this.allowed = allowed
}

plots.push(new Plot(172,144,128,128,['village0']));
plots.push(new Plot(450,272,128,128,['farm']));
plots.push(new Plot(600,144,128,128,['village1', 'village0']));
plots.push(new Plot(204, 304, 128, 128, ['farm']));

/**
  TODO: Plots will be used for the building locations,
   * Action should be if mouse over and dragging is not null,
   * display a highlighted area showing where that draggable
   * item can be dropped. Update DragObject.clicked to loop
   * through Plots and, similar to canvas.click, find which
   * one it is over before dropping there if allowed.

   * Consider making it such that you can only have one item in each
   * plot, and that the item will sit in a designated location
   * on the plot after it is dropped on the plot.

   * ALSO TODO: Instead of createImage'ing every time you need it, make an array
   * or object containing each unique image
**/

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

  //draw the world and everything in it
  aWorld.draw();
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

function basicWorldDraw(bgImage) {
  var ptrn = ctx.createPatern(bgImage, 'repeat');
  ctx.fillStyle = ptrn;
  ctx.fillRect(this.minX, this.minY, this.maxX, this.maxY);

  $.each(this.gameObjects.tiles.statics, justDraw(key, value));
  $.each(this.gameObjects.tiles.interactables.plots, justDraw(key, value));
  $.each(this.gameObjects.tiles.interactables.entities, justDraw(key, value));
  $.each(this.gameObjects.tiles.interactables.UI, justDraw(key, value));
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

//Utility functions
function clear() {
  ctx.setTransform(1,0,0,1,0,0);//reset the transform matrix as it is cumulative
  ctx.clearRect(0, 0, canvas.width, canvas.height);//clear the viewport after matrix is reset
}

function justDraw(key, value) {
  value.draw();
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

$(document).ready(function() {
  console.log("Javascript Ready")
  function update() {
    mainLoop();
    requestAnimationFrame(update)
  }
});
