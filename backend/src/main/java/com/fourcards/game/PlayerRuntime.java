package com.fourcards.game;

import com.fourcards.model.*;
import java.util.*;

public class PlayerRuntime {
    public final String id;
    public final String name;
    public final boolean host;
    public final boolean bot;
    public final BotDifficulty botDifficulty;

    public final List<Card> hand = new ArrayList<>();
    public int score;
    /** Points earned in the current round; null outside round-result presentation. */
    public Integer roundScore;
    public PlayerStatus status = PlayerStatus.CONNECTED;
    public boolean dealer;
    /** Current WebSocket session. Older sessions cannot disconnect a newer one. */
    public volatile String websocketSessionId;

    public PlayerRuntime(String id, String name, boolean host) {
        this(id, name, host, false, BotDifficulty.NORMAL);
    }

    public PlayerRuntime(
            String id,
            String name,
            boolean host,
            boolean bot,
            BotDifficulty botDifficulty
    ) {
        this.id = id;
        this.name = name;
        this.host = host;
        this.bot = bot;
        this.botDifficulty = botDifficulty == null
                ? BotDifficulty.NORMAL
                : botDifficulty;
    }

    public boolean active() {
        return status == PlayerStatus.CONNECTED;
    }
}
