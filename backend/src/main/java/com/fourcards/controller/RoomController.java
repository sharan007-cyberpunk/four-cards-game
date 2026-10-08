package com.fourcards.controller;
import com.fourcards.dto.*; import com.fourcards.service.GameService; import jakarta.validation.Valid; import org.springframework.http.ResponseEntity; import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/rooms") public class RoomController { private final GameService service; public RoomController(GameService service){this.service=service;}
 @PostMapping public RoomResponse create(@Valid @RequestBody CreateGameRequest r){return service.create(r.playerName(),r.targetScore(),r.botCount(),r.botDifficulty());}
 @PostMapping("/{code}/join") public RoomResponse join(@PathVariable String code,@Valid @RequestBody JoinGameRequest r){return service.join(code,r.playerName());}
 @PostMapping("/{code}/reconnect") public ResponseEntity<Void> reconnect(@PathVariable String code,@RequestBody ReconnectRequest r){service.reconnect(code,r.playerId());return ResponseEntity.noContent().build();}
 @GetMapping("/{code}") public PublicGameState room(@PathVariable String code){return service.publicState(code);}
 @PutMapping("/{code}/settings/timer") public ResponseEntity<Void> timer(@PathVariable String code,@RequestParam String playerId,@RequestParam int value){service.setTurnSeconds(code,playerId,value);return ResponseEntity.noContent().build();}
 @PutMapping("/{code}/settings/target") public ResponseEntity<Void> target(@PathVariable String code,@RequestParam String playerId,@RequestParam int value){service.setTarget(code,playerId,value);return ResponseEntity.noContent().build();}
 @PostMapping("/{code}/start") public ResponseEntity<Void> start(@PathVariable String code,@RequestBody StartGameRequest r){service.start(code,r.playerId());return ResponseEntity.noContent().build();}
}
